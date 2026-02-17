import { authService } from "./authService";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.unklab-aicode.online/api';

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  last_code?: string | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface CodeSnippet {
  id: string;
  user_id: string;
  conversation_id?: string;
  title?: string;
  code_content: string;
  language: string;
  created_at: string;
}

class BackendService {
  // ===== CONVERSATIONS =====
  
  async getConversations(userId: string, limit = 50): Promise<{ data: Conversation[] | null; error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/${userId}?limit=${limit}`, {
        headers: authService.getAuthHeaders()
      });
      if (!response.ok) throw new Error(`Failed to fetch conversations: ${response.statusText}`);
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  async getConversation(id: string): Promise<{ data: Conversation | null; error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/${id}`, {
        headers: authService.getAuthHeaders()
      });
      if (!response.ok) throw new Error(`Failed to fetch conversation: ${response.statusText}`);
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  async createConversation(userId: string, title: string): Promise<{ data: Conversation | null; error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders()
        },
        body: JSON.stringify({ userId, title })
      });
      if (!response.ok) throw new Error(`Failed to create conversation: ${response.statusText}`);
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<{ error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders()
        },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error(`Failed to update conversation: ${response.statusText}`);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async deleteConversation(id: string): Promise<{ error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/${id}`, {
        method: 'DELETE',
        headers: authService.getAuthHeaders()
      });
      if (!response.ok) throw new Error(`Failed to delete conversation: ${response.statusText}`);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  // ===== MESSAGES =====

  async getMessages(conversationId: string): Promise<{ data: ChatMessage[] | null; error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/messages/${conversationId}`, {
        headers: authService.getAuthHeaders()
      });
      if (!response.ok) throw new Error(`Failed to fetch messages: ${response.statusText}`);
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  async addMessage(conversationId: string, userId: string, role: 'user' | 'assistant', content: string): Promise<{ data: ChatMessage | null; error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders()
        },
        body: JSON.stringify({ conversationId, userId, role, content })
      });
      if (!response.ok) throw new Error(`Failed to add message: ${response.statusText}`);
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  async deleteMessage(id: string): Promise<{ error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/messages/${id}`, {
        method: 'DELETE',
        headers: authService.getAuthHeaders()
      });
      if (!response.ok) throw new Error(`Failed to delete message: ${response.statusText}`);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  // ===== CODE SNIPPETS =====

  async getCodeByConversation(conversationId: string): Promise<{ data: CodeSnippet[] | null; error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/code/conversation/${conversationId}`, {
        headers: authService.getAuthHeaders()
      });
      if (!response.ok) throw new Error(`Failed to fetch code by conversation: ${response.statusText}`);
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  async getCodeSnippets(userId: string): Promise<{ data: CodeSnippet[] | null; error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/code/${userId}`, {
        headers: authService.getAuthHeaders()
      });
      if (!response.ok) throw new Error(`Failed to fetch code snippets: ${response.statusText}`);
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  async saveCodeSnippet(userId: string, code: string, language: string, conversationId?: string, title?: string): Promise<{ data: CodeSnippet | null; error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/code`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders()
        },
        body: JSON.stringify({ userId, code_content: code, language, conversationId: conversationId, title })
      });
      if (!response.ok) throw new Error(`Failed to save code snippet: ${response.statusText}`);
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  async deleteCodeSnippet(id: string): Promise<{ error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/code/${id}`, {
        method: 'DELETE',
        headers: authService.getAuthHeaders()
      });
      if (!response.ok) throw new Error(`Failed to delete code snippet: ${response.statusText}`);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }
}

export const backendService = new BackendService();
