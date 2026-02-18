# UNKLAB AI Code - AI-Powered Python Coding Assistant

UNKLAB AI Code is an interactive Python coding environment featuring an AI chatbot assistant. Write, execute, and improve your Python code with instant feedback and debugging help.

## Features

- **Integrated Python Editor**: Powerful editor with syntax highlighting and auto-formatting.
- **Embedded Runtime**: Run Python code directly in your browser using Skulpt.
- **AI Chat Assistant**: Get help with debugging, code review, and learning Python concepts.
- **One-Click Debugger**: Automatically send errors to the AI for analysis.
- **Persistent Sessions**: Secure login and chat history management.

## Getting Started

### Local Development

1. **Clone the repository**:

   ```sh
   git clone <YOUR_GIT_URL>
   cd gemini-code-play
   ```

2. **Install dependencies**:

   ```sh
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file based on `.env.example` (if available) or set the following:
   - `VITE_API_BASE_URL`: URL of your backend server.

4. **Start the development server**:
   ```sh
   npm run dev
   ```

## Technologies Used

- **Frontend**: Vite, React, TypeScript, Tailwind CSS, shadcn/ui.
- **State Management**: React Context, TanStack Query.
- **Python Runtime**: Skulpt.
- **Backend Integration**: Node.js/Express (separate repo).
- **Icons**: Lucide React.

## Deployment

The project can be deployed to any static site hosting provider (like Vercel, Netlify, or a VPS with Nginx).

1. **Build the project**:

   ```sh
   npm run build
   ```

2. **Deploy the `dist` folder** to your server.

---

Built for developers, by UNKLAB AI Code Team.
