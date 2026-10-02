import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authAPI, getApiError } from '@/services/api';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'USER' | 'WORKER' | 'ADMIN';
  latitude?: number;
  longitude?: number;
  address?: string;
  workerProfile?: {
    id: string;
    serviceType: string;
    isAvailable: boolean;
    isPublic?: boolean;
    bio?: string;
    address?: string;
    rating: number;
    totalJobs: number;
    serviceKey?: string;
    applicationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
    applicationNote?: string;
    panVerified?: boolean;
    faceVerified?: boolean;
    verification?: { face: string; document: string; pan: string };
  };
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
};

export const login = createAsyncThunk('auth/login', async (credentials: { email: string; password: string; portal?: string }, { rejectWithValue }) => {
  try {
    const { data } = await authAPI.login(credentials);
    localStorage.setItem('Zoon_login_portal', data.data.user.role);
    return data.data;
  } catch (err: any) {
    return rejectWithValue(getApiError(err, 'Login failed'));
  }
});

export const register = createAsyncThunk('auth/register', async (userData: any, { rejectWithValue }) => {
  try {
    const { data } = await authAPI.register(userData);
    localStorage.setItem('Zoon_login_portal', 'USER');
    return data.data;
  } catch (err: any) {
    return rejectWithValue(getApiError(err, 'Registration failed'));
  }
});

export const registerProfessional = createAsyncThunk('auth/registerProfessional', async (userData: any, { rejectWithValue }) => {
  try {
    const { idDocument, idDocumentName, idDocumentMime, location, ...payload } = userData;
    const { data } = await authAPI.registerProfessional(payload);
    return data.data;
  } catch (err: any) {
    return rejectWithValue(getApiError(err, 'Professional application failed'));
  }
});

export const fetchProfile = createAsyncThunk('auth/fetchProfile', async (_, { rejectWithValue }) => {
  try {
    const { data } = await authAPI.getProfile();
    return data.data;
  } catch (err: any) {
    return rejectWithValue(getApiError(err, 'Failed to fetch profile'));
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    restoreSession: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('Zoon_token');
        localStorage.removeItem('Zoon_user');
        localStorage.removeItem('sessionId');
      }
    },
    clearError: (state) => { state.error = null; },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) { state.user = { ...state.user, ...action.payload }; localStorage.setItem('Zoon_user', JSON.stringify(state.user)); }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(login.fulfilled, (s, a) => {
        s.loading = false;
        s.user = a.payload.user;
        s.token = a.payload.token;
        if (typeof window !== 'undefined') {
          localStorage.setItem('Zoon_token', a.payload.token);
          localStorage.setItem('Zoon_user', JSON.stringify(a.payload.user));
        }
      })
      .addCase(login.rejected, (s, a) => { s.loading = false; s.error = a.payload as string; })
      .addCase(register.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(register.fulfilled, (s, a) => {
        s.loading = false;
        s.user = a.payload.user;
        s.token = a.payload.token;
        if (typeof window !== 'undefined') {
          localStorage.setItem('Zoon_token', a.payload.token);
          localStorage.setItem('Zoon_user', JSON.stringify(a.payload.user));
        }
      })
      .addCase(register.rejected, (s, a) => { s.loading = false; s.error = a.payload as string; })
      .addCase(registerProfessional.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(registerProfessional.fulfilled, (s, a) => {
        s.loading = false; s.user = a.payload.user; s.token = a.payload.token;
        if (typeof window !== 'undefined') {
          localStorage.setItem('Zoon_token', a.payload.token);
          localStorage.setItem('Zoon_user', JSON.stringify(a.payload.user));
        }
      })
      .addCase(registerProfessional.rejected, (s, a) => { s.loading = false; s.error = a.payload as string; })
      .addCase(fetchProfile.fulfilled, (s, a) => { s.user = a.payload; });
  },
});

export const { logout, clearError, updateUser, restoreSession } = authSlice.actions;
export default authSlice.reducer;
