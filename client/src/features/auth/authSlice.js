import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api, getApiMessage } from "../../lib/api.js";

export const restoreSession = createAsyncThunk(
  "auth/restoreSession",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/auth/me");
      return response.data.data.user;
    } catch (error) {
      return rejectWithValue(getApiMessage(error));
    }
  },
);

export const login = createAsyncThunk(
  "auth/login",
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await api.post("/auth/login", credentials);
      return response.data.data.user;
    } catch (error) {
      return rejectWithValue(getApiMessage(error));
    }
  },
);

export const register = createAsyncThunk(
  "auth/register",
  async (details, { rejectWithValue }) => {
    try {
      const response = await api.post("/auth/register", details);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(getApiMessage(error));
    }
  },
);

export const verifyEmail = createAsyncThunk(
  "auth/verifyEmail",
  async (details, { rejectWithValue }) => {
    try {
      const response = await api.post("/auth/verify-email", details);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(getApiMessage(error));
    }
  },
);

export const logout = createAsyncThunk("auth/logout", async () => {
  await api.post("/auth/logout");
});

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    status: "checking",
    submitting: false,
    error: null,
  },
  reducers: {
    sessionExpired(state) {
      state.user = null;
      state.status = "anonymous";
      state.submitting = false;
      state.error = null;
    },
    clearAuthError(state) {
      state.error = null;
    },
    profileUpdated(state, action) {
      state.user = action.payload;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(restoreSession.pending, (state) => {
        state.status = "checking";
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "authenticated";
        state.error = null;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.user = null;
        state.status = "anonymous";
      })
      .addCase(login.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "authenticated";
        state.submitting = false;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.submitting = false;
        state.status = "anonymous";
        state.error = action.payload || "Sign in failed. Please try again.";
      })
      .addCase(register.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.status = "authenticated";
        state.submitting = false;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.submitting = false;
        state.status = "anonymous";
        state.error =
          action.payload || "Account creation failed. Please try again.";
      })
      .addCase(verifyEmail.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(verifyEmail.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.submitting = false;
        state.error = null;
      })
      .addCase(verifyEmail.rejected, (state, action) => {
        state.submitting = false;
        state.error =
          action.payload || "Email verification failed. Please try again.";
      })
      .addCase(logout.pending, (state) => {
        state.submitting = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.status = "anonymous";
        state.submitting = false;
        state.error = null;
      })
      .addCase(logout.rejected, (state) => {
        state.submitting = false;
        state.error = "Could not sign out. Check your connection and retry.";
      });
  },
});

export const { clearAuthError, profileUpdated, sessionExpired } =
  authSlice.actions;
export default authSlice.reducer;
