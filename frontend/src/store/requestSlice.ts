import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { requestAPI, workerAPI } from '@/services/api';

interface RequestState {
  requests: any[];
  workerRequests: any[];
  loading: boolean;
  error: string | null;
}

const initialState: RequestState = {
  requests: [],
  workerRequests: [],
  loading: false,
  error: null,
};

export const fetchUserRequests = createAsyncThunk('request/fetchUser', async (_, { rejectWithValue }) => {
  try {
    const { data } = await requestAPI.getMyRequests();
    return data.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const fetchWorkerRequests = createAsyncThunk('request/fetchWorker', async (_, { rejectWithValue }) => {
  try {
    const { data } = await workerAPI.getMyRequests();
    return data.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message);
  }
});

const requestSlice = createSlice({
  name: 'request',
  initialState,
  reducers: {
    updateRequestStatus: (state, action) => {
      const { requestId, status } = action.payload;
      const req = state.requests.find(r => r.id === requestId);
      if (req) req.status = status;
      const wreq = state.workerRequests.find(r => r.id === requestId);
      if (wreq) wreq.status = status;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserRequests.pending, (s) => { s.loading = true; })
      .addCase(fetchUserRequests.fulfilled, (s, a) => { s.loading = false; s.requests = a.payload; })
      .addCase(fetchUserRequests.rejected, (s, a) => { s.loading = false; s.error = a.payload as string; })
      .addCase(fetchWorkerRequests.pending, (s) => { s.loading = true; })
      .addCase(fetchWorkerRequests.fulfilled, (s, a) => { s.loading = false; s.workerRequests = a.payload; })
      .addCase(fetchWorkerRequests.rejected, (s, a) => { s.loading = false; s.error = a.payload as string; });
  },
});

export const { updateRequestStatus } = requestSlice.actions;
export default requestSlice.reducer;
