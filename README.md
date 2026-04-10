# Griggs Hub

 Griggs Hub is a specialized management platform originally designed for **Griggs Capital Partners**. It serves as an all-in-one "command center" to oversee system infrastructure, project development, customer relationships, and AI intelligence.

Built with a focus on modern aesthetics, real-time collaboration, and data-driven insights, the Hub enables teams to move faster and stay synchronized.

## Key Features

- **Unified Dashboard**: A high-level overview of farm performance, active projects, and recent activity events.
- **Project Tracking (GitHub Sync)**: Deep integration with GitHub to pull repositories, issues, and sync them with internal Kanban boards for seamless developer-to-operator coordination.
- **Customer & Document Management**: Centralized CRM for managing farm partners and their critical documentation (machine learning summaries and tagging supported).
- **Activity Stream**: A persistent log of all major actions across the platform to ensure auditability and team awareness.
- **Team Jam**: Spotify Jam integration that lets teammates listen to music together while they work. One person starts a Jam in Spotify, pastes the join link into the Hub, and a live notification appears for everyone else with a one-click "Join in Spotify" button. Listener presence is tracked in real-time and a **Team Jam node** can be placed in any architecture diagram to visualize who is listening.

## Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org) (App Router)
- **Database**: [Neon](https://neon.tech) (PostgreSQL) with [Prisma ORM](https://prisma.io)
- **Authentication**: [NextAuth.js v5 Beta](https://authjs.dev)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com) & [Framer Motion](https://framer.com/motion)
- **UI Components**: [Radix UI](https://radix-ui.com) & [Lucide Icons](https://lucide.dev)
- **Visualization**: [Recharts](https://recharts.org) & [XYFlow](https://xyflow.com)

## Local Development

### Prerequisites

- Node.js 20+
- A Neon PostgreSQL project (or local Postgres)
- GitHub OAuth App (for authentication)
- Resend API Key (for transactional emails)

### Getting Started

1. **Clone and Install**:
   ```bash
   git clone https://github.com/griggs-capital-partners/hub.git
   cd hub
   npm install
   ```

2. **Environment Variables**:
   Copy `.env.local.example` to `.env.local` and fill in the required values:
   ```bash
   cp .env.local.example .env.local
   ```
   *Required Keys:* `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_TOKEN`.

3. **Database Setup**:
   Generate the Prisma client and push the schema to your database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to see the Hub in action.

## Deployment & Requirements

To spin up a separate instance of the Griggs Hub, you will need:

1. **Authentication**: A GitHub OAuth application with a configured callback URL (e.g., `https://your-hub.com/api/auth/callback/github`).
2. **Access Control**: Configure the `ALLOWED_GITHUB_USERS` environment variable to restrict access to specific team members.
3. **Database**: A PostgreSQL instance (Neon is recommended for its serverless pooling capabilities).
4. **Hosting**: Optimized for **AWS Amplify** or **Vercel** with support for Next.js 15.

---

Managed by [Griggs Capital Partners](https://summitsmartfarms.com).

