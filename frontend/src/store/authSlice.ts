import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authAPI } from '@/services/api';

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
    rating: number;
    totalJobs: number;
  };
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('homefix_user') || 'null') : null,
  token: typeof window !== 'undefined' ? localStorage.getItem('homefix_token') : null,
  loading: false,
  error: null,
};

export const login = createAsyncThunk('auth/login', async (credentials: { email: string; password: string }, { rejectWithValue }) => {
  try {
    const { data } = await authAPI.login(credentials);
    return data.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Login failed');
  }
});

export const register = createAsyncThunk('auth/register', async (userData: any, { rejectWithValue }) => {
  try {
    const { data } = await authAPI.register(userData);
    return data.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Registration failed');
  }
});

export const fetchProfile = createAsyncThunk('auth/fetchProfile', async (_, { rejectWithValue }) => {
  try {
    const { data } = await authAPI.getProfile();
    return data.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch profile');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('homefix_token');
        localStorage.removeItem('homefix_user');
      }
    },
    clearError: (state) => { state.error = null; },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) state.user = { ...state.user, ...action.payload };
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
          localStorage.setItem('homefix_token', a.payload.token);
          localStorage.setItem('homefix_user', JSON.stringify(a.payload.user));
        }
      })
      .addCase(login.rejected, (s, a) => { s.loading = false; s.error = a.payload as string; })
      .addCase(register.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(register.fulfilled, (s, a) => {
        s.loading = false;
        s.user = a.payload.user;
        s.token = a.payload.token;
        if (typeof window !== 'undefined') {
          localStorage.setItem('homefix_token', a.payload.token);
          localStorage.setItem('homefix_user', JSON.stringify(a.payload.user));
        }
      })
      .addCase(register.rejected, (s, a) => { s.loading = false; s.error = a.payload as string; })
      .addCase(fetchProfile.fulfilled, (s, a) => { s.user = a.payload; });
  },
});

export const { logout, clearError, updateUser } = authSlice.actions;
export default authSlice.reducer;
