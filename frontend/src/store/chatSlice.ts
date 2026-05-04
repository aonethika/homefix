import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { chatAPI } from '@/services/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
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
};

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ message, sessionId }: { message: string; sessionId?: string }, { rejectWithValue }) => {
    try {
      const { data } = await chatAPI.sendMessage(message, sessionId);
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to send message');
    }
  }
);

export const loadSession = createAsyncThunk(
  'chat/loadSession',
  async (sessionId: string, { rejectWithValue }) => {
    try {
      const { data } = await chatAPI.getSession(sessionId);
      return data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load session');
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
      return rejectWithValue(err.response?.data?.message || 'Failed to create session');
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
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addBotMessage: (state, action: PayloadAction<{ content: string; metadata?: any }>) => {
      state.messages.push({
        id: Date.now().toString(),
        role: 'bot',
        content: action.payload.content,
        metadata: action.payload.metadata,
        createdAt: new Date().toISOString(),
      });
    },
    setCurrentRequest: (state, action: PayloadAction<any>) => {
      state.currentRequest = action.payload;
    },
    resetChat: (state) => {
      state.sessionId = null;
      state.messages = [];
      state.state = 'INIT';
      state.currentRequest = null;
    },
    updateChatState: (state, action: PayloadAction<string>) => {
      state.state = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendMessage.pending, (s) => { s.sending = true; s.error = null; })
      .addCase(sendMessage.fulfilled, (s, a) => {
        s.sending = false;
        s.sessionId = a.payload.sessionId;
        s.state = a.payload.state || s.state;
        const botMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'bot',
          content: a.payload.reply,
          metadata: a.payload.metadata,
          createdAt: new Date().toISOString(),
        };
        s.messages.push(botMsg);
      })
      .addCase(sendMessage.rejected, (s, a) => {
        s.sending = false;
        s.error = a.payload as string;
      })
      .addCase(loadSession.pending, (s) => { s.loading = true; })
      .addCase(loadSession.fulfilled, (s, a) => {
        s.loading = false;
        s.sessionId = a.payload.id;
        s.messages = a.payload.messages || [];
        s.state = a.payload.state;
        s.currentRequest = a.payload.request || null;
      })
      .addCase(loadSession.rejected, (s) => { s.loading = false; })
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

export const { addBotMessage, setCurrentRequest, resetChat, updateChatState } = chatSlice.actions;
export default chatSlice.reducer;
