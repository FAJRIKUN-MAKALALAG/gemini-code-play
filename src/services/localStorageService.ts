import { safeLocalStorage } from "@/utils/storageUtils";

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

class LocalStorageService {
  private readonly CONVERSATIONS_KEY = 'local_conversations';
  private readonly MESSAGES_KEY = 'local_messages';

  // Get all conversations
  private getAllConversations(): Conversation[] {
    const data = safeLocalStorage.getItem(this.CONVERSATIONS_KEY);
    return data ? JSON.parse(data) : [];
  }

  // Save all conversations
  private saveConversations(conversations: Conversation[]) {
    safeLocalStorage.setItem(this.CONVERSATIONS_KEY, JSON.stringify(conversations));
  }

  // Get all messages
  private getAllMessages(): ChatMessage[] {
    const data = safeLocalStorage.getItem(this.MESSAGES_KEY);
    return data ? JSON.parse(data) : [];
  }

  // Save all messages
  private saveMessages(messages: ChatMessage[]) {
    safeLocalStorage.setItem(this.MESSAGES_KEY, JSON.stringify(messages));
  }

  // Create new conversation
  async createConversation(userId: string, title: string): Promise<{ data: Conversation | null; error: Error | null }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const conversations = this.getAllConversations();
        const newConversation: Conversation = {
          id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          user_id: userId,
          title,
          created_at: new Date().toISOString(),
          last_code: null,
        };

        conversations.push(newConversation);
        this.saveConversations(conversations);

        resolve({ data: newConversation, error: null });
      }, 50);
    });
  }

  // Get conversations for user
  async getConversations(userId: string, limit: number = 50): Promise<{ data: Conversation[] | null; error: Error | null }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const conversations = this.getAllConversations()
          .filter(c => c.user_id === userId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, limit);

        resolve({ data: conversations, error: null });
      }, 50);
    });
  }

  // Get single conversation
  async getConversation(conversationId: string): Promise<{ data: Conversation | null; error: Error | null }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const conversations = this.getAllConversations();
        const conversation = conversations.find(c => c.id === conversationId);

        resolve({ data: conversation || null, error: null });
      }, 50);
    });
  }

  // Update conversation
  async updateConversation(conversationId: string, updates: Partial<Conversation>): Promise<{ data: Conversation | null; error: Error | null }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const conversations = this.getAllConversations();
        const index = conversations.findIndex(c => c.id === conversationId);

        if (index === -1) {
          resolve({ data: null, error: new Error('Conversation not found') });
          return;
        }

        conversations[index] = { ...conversations[index], ...updates };
        this.saveConversations(conversations);

        resolve({ data: conversations[index], error: null });
      }, 50);
    });
  }

  // Delete conversation
  async deleteConversation(conversationId: string): Promise<{ error: Error | null }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        let conversations = this.getAllConversations();
        conversations = conversations.filter(c => c.id !== conversationId);
        this.saveConversations(conversations);

        // Also delete associated messages
        let messages = this.getAllMessages();
        messages = messages.filter(m => m.conversation_id !== conversationId);
        this.saveMessages(messages);

        resolve({ error: null });
      }, 50);
    });
  }

  // Add message to conversation
  async addMessage(conversationId: string, userId: string, role: 'user' | 'assistant', content: string): Promise<{ data: ChatMessage | null; error: Error | null }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const messages = this.getAllMessages();
        const newMessage: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          conversation_id: conversationId,
          user_id: userId,
          role,
          content,
          created_at: new Date().toISOString(),
        };

        messages.push(newMessage);
        this.saveMessages(messages);

        resolve({ data: newMessage, error: null });
      }, 50);
    });
  }

  // Get messages for conversation
  async getMessages(conversationId: string): Promise<{ data: ChatMessage[] | null; error: Error | null }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const messages = this.getAllMessages()
          .filter(m => m.conversation_id === conversationId)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        resolve({ data: messages, error: null });
      }, 50);
    });
  }

  // Clear all data (for testing/reset)
  clearAllData() {
    safeLocalStorage.removeItem(this.CONVERSATIONS_KEY);
    safeLocalStorage.removeItem(this.MESSAGES_KEY);
  }
}

// Export singleton instance
export const localStorageService = new LocalStorageService();
