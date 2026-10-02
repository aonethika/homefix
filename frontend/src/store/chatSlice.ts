import { logout } from './authSlice';
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { chatAPI, getApiError } from '@/services/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot' | 'worker';
  content: string;
  metadata?: any;
  createdAt: string;
}

interface ChatState {
  sessionId: string | null;
  messages: ChatMessage[];
  state: string;
  loading: boolean;
  sending: boolean;
  error: string | null;
  sessions: any[];
  currentRequest: any | null;
  activeSendId: string | null;
  activeLoadId: string | null;
  stopping: boolean;
}

const initialState: ChatState = {
  sessionId: null,
  messages: [],
  state: 'INIT',
  loading: false,
  sending: false,
  error: null,
  sessions: [],
  currentRequest: null,
  activeSendId: null, activeLoadId: null, stopping: false,
};

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ message, sessionId, safetyAcknowledged }: { message: string; sessionId?: string; safetyAcknowledged?: boolean }, { rejectWithValue, signal, dispatch, getState, requestId }) => {
    try {
      if (!sessionId) {
        const created = await chatAPI.createSession();
        if (signal.aborted || (getState() as { chat: ChatState }).chat.activeSendId !== requestId) throw new Error('Conversation changed');
        sessionId = created.data.data.id;
        dispatch(prepareSession({ sessionId: sessionId!, requestId }));
      }
      const { data } = await chatAPI.sendMessage(message, sessionId, safetyAcknowledged, signal);
      return data.data;
    } catch (err: any) {
      return rejectWithValue(getApiError(err, 'Failed to send message'));
    }
  },
  { condition: (_, { getState }) => { const chat = (getState() as { chat: ChatState }).chat; return !chat.sending && !chat.stopping; } }
);

export const loadSession = createAsyncThunk(
  'chat/loadSession',
  async (sessionId: string, { rejectWithValue, signal }) => {
    try {
      const { data } = await chatAPI.getSession(sessionId, signal);
      return data.data;
    } catch (err: any) {
      return rejectWithValue(getApiError(err, 'Failed to load session'));
    }
  }
);

export const createNewSession = createAsyncThunk(
  'chat/createSession',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await chatAPI.createSession();
      return data.data;
    } catch (err: any) {
      return rejectWithValue(getApiError(err, 'Failed to create session'));
    }
  }
);

export const fetchSessions = createAsyncThunk(
  'chat/fetchSessions',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await chatAPI.getSessions();
      return data.data;
    } catch (err: any) {
      return rejectWithValue(getApiError(err, 'Failed to load conversations'));
    }
  }
);

export const stopChat = createAsyncThunk('chat/stop', async ({ sessionId, expectedStatus }: { sessionId: string; expectedStatus?: string }, { rejectWithValue }) => {
  try { return (await chatAPI.stopSession(sessionId, expectedStatus)).data.data; }
  catch (error) { return rejectWithValue(getApiError(error, 'Could not stop the search. Try again.')); }
}, { condition: (_, { getState }) => !(getState() as { chat: ChatState }).chat.stopping });

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    prepareSession: (state, action: PayloadAction<{ sessionId: string; requestId: string }>) => {
      if (state.activeSendId === action.payload.requestId) state.sessionId = action.payload.sessionId;
    },
    addUserMessage: (state, action: PayloadAction<string>) => {
      state.messages.push({
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: 'user',
        content: action.payload,
        createdAt: new Date().toISOString(),
      });
    },
    addBotMessage: (state, action: PayloadAction<{ content: string; metadata?: any }>) => {
      state.messages.push({
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: 'bot',
        content: action.payload.content,
        metadata: action.payload.metadata,
        createdAt: new Date().toISOString(),
      });
    },
    addChatMessage: (state, action: PayloadAction<ChatMessage>) => {
      if (!state.messages.some(message => message.id === action.payload.id)) state.messages.push(action.payload);
    },
    setCurrentRequest: (state, action: PayloadAction<any>) => {
      state.currentRequest = action.payload;
    },
    resetChat: (state) => {
      state.sessionId = null;
      state.messages = [];
      state.state = 'INIT';
      state.currentRequest = null;
      state.activeSendId = null; state.activeLoadId = null; state.sending = false; state.loading = false; state.error = null;
    },
    updateChatState: (state, action: PayloadAction<string>) => {
      state.state = action.payload;
    },
    updateCurrentRequestStatus: (state, action: PayloadAction<{ requestId: string; status: string }>) => {
      if (state.currentRequest?.id === action.payload.requestId) {
        if (['CANCELLED', 'REJECTED'].includes(state.currentRequest.status) && action.payload.status !== state.currentRequest.status) return;
        state.currentRequest.status = action.payload.status;
        if (['CANCELLED', 'REJECTED'].includes(action.payload.status)) {
          state.state = 'COMPLETED'; state.sending = false; state.loading = false;
          state.activeSendId = null; state.activeLoadId = null;
        }
      }
    },
    setCurrentWorker: (state, action: PayloadAction<{ requestId: string; workerName: string }>) => {
      if (state.currentRequest?.id === action.payload.requestId) {
        state.currentRequest.worker = { ...(state.currentRequest.worker || {}), user: { ...(state.currentRequest.worker?.user || {}), name: action.payload.workerName } };
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logout, () => initialState);
    builder.addCase(stopChat.pending, s => { s.stopping = true; s.sending = false; s.loading = false; s.activeSendId = null; s.activeLoadId = null; s.error = null; });
    builder.addCase(stopChat.fulfilled, (s, a) => {
      s.stopping = false; s.state = 'COMPLETED'; s.currentRequest = a.payload.request;
    });
    builder.addCase(stopChat.rejected, (s, a) => { s.stopping = false; s.error = String(a.payload || 'Could not cancel. Try again.'); });
    builder
      .addCase(sendMessage.pending, (s, a) => { s.sending = true; s.error = null; s.activeSendId = a.meta.requestId; })
      .addCase(sendMessage.fulfilled, (s, a) => {
        if (s.activeSendId !== a.meta.requestId) return;
        s.activeSendId = null;
        s.sending = false;
        s.sessionId = a.payload.sessionId;
        s.state = a.payload.state || s.state;
        if (a.payload.metadata?.requestId) {
          s.currentRequest = {
            ...(s.currentRequest || {}),
            id: a.payload.metadata.requestId,
            status: a.payload.metadata.requestStatus || (a.payload.state === 'PAYMENT_PENDING' ? 'PAYMENT_PENDING' : (s.currentRequest?.status || 'ASSIGNED')),
          };
        }
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          role: 'bot',
          content: a.payload.reply,
          metadata: a.payload.metadata,
          createdAt: new Date().toISOString(),
        };
        s.messages.push(botMsg);
      })
      .addCase(sendMessage.rejected, (s, a) => {
        if (s.activeSendId !== a.meta.requestId) return;
        s.activeSendId = null;
        s.sending = false;
        s.error = a.payload as string;
      })
      .addCase(loadSession.pending, (s, a) => { if (s.stopping) return; s.loading = true; s.activeLoadId = a.meta.requestId; })
      .addCase(loadSession.fulfilled, (s, a) => {
        if (s.activeLoadId !== a.meta.requestId || s.stopping) return;
        s.activeLoadId = null;
        s.loading = false;
        s.sessionId = a.payload.id;
        s.messages = a.payload.messages || [];
        s.state = a.payload.state;
        s.currentRequest = a.payload.request || null;
      })
      .addCase(loadSession.rejected, (s, a) => { if (s.activeLoadId !== a.meta.requestId) return; s.activeLoadId = null; s.loading = false; })
      .addCase(createNewSession.fulfilled, (s, a) => {
        s.sessionId = a.payload.id;
        s.messages = [];
        s.state = 'INIT';
        s.currentRequest = null;
      })
      .addCase(fetchSessions.fulfilled, (s, a) => {
        s.sessions = a.payload;
      });
  },
});

export const { prepareSession, addUserMessage, addBotMessage, addChatMessage, setCurrentRequest, resetChat, updateChatState, updateCurrentRequestStatus, setCurrentWorker } = chatSlice.actions;
export default chatSlice.reducer;
