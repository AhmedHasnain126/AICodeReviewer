# AI Code Reviewer 🤖

![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg) ![Express.js](https://img.shields.io/badge/Express.js-4.x-blue.svg) ![React](https://img.shields.io/badge/React-17.x-cyan.svg) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14.x-purple.svg)

An intelligent full-stack application that leverages the Google Gemini API to provide expert code reviews. Upload a code file, provide instructions, and receive a detailed analysis covering potential bugs, performance improvements, and best practices.

## Features ✨

-   **Secure File Uploads**: Supports a wide range of programming languages with validation for file types and size.
-   **AI-Powered Analysis**: Integrates with the Google Gemini API to generate comprehensive code reviews.
-   **Modern Frontend**: A clean and responsive single-page application built with React.
-   **Persistent Storage**: Saves all review reports to a PostgreSQL database for future reference.
-   **Full CRUD Functionality**: View a list of past reports, see detailed views, and delete old reports.

## Tech Stack 🛠️

-   **Backend**: Node.js, Express.js
-   **Frontend**: HTML
-   **Database**: PostgreSQL
-   **AI Model**: Google Gemini API
-   **Styling**: Tailwind CSS

## Project Structure

```plaintext
/
├── public/
│   ├── index.html      # React app host
│   └── App.jsx         # React application
├── uploads/            # (Git ignored) Temp folder for file uploads
├── .env                # (Git ignored) Environment variables
├── .env.example        # Example environment file
├── .gitignore          # Specifies files for Git to ignore
├── db.js               # PostgreSQL connection setup
├── package.json        # Project dependencies
└── server.js           # Express server and API logic
## Getting Started 🚀

Follow these instructions to get a local copy of the project up and running.

### Prerequisites

-   **Node.js**: Version 18.x or later.
-   **PostgreSQL**: A running instance of PostgreSQL.
-   **Git**: For cloning the repository.

### Installation & Setup

1.  **Clone the Repository**
    ```bash
    git clone <your-repository-url>
    cd ai-code-reviewer
    ```

2.  **Install Backend Dependencies**
    ```bash
    npm install
    ```

3.  **Set Up the PostgreSQL Database**
    -   Connect to your PostgreSQL instance.
    -   Create a new database (e.g., `codereviewdb`).
    -   Run the following SQL script to create the necessary table:
        ```sql
        CREATE TABLE reviews (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL,
            review_prompt TEXT,
            report TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        ```

4.  **Configure Environment Variables**
    -   Create a `.env` file in the root of the project.
    -   Copy the contents of `.env.example` into it.
    -   Fill in your actual `GEMINI_API_KEY` and `DATABASE_URL`.
        ```env
        # .env
        PORT=5000
        GEMINI_API_KEY="AIzaSy..."
        DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/codereviewdb"
        ```

5.  **Run the Application**
    ```bash
    npm start
    ```
    The server will start, and you can access the application by navigating to `http://localhost:5000` in your web browser.

## API Endpoints 📋

-   `POST /api/analyze`: Uploads a file and prompt to generate a new code review.
-   `GET /api/reports`: Retrieves a list of all past review summaries.
-   `GET /api/reports/:id`: Retrieves the full details of a single report.
-   `DELETE /api/reports/:id`: Deletes a specific report.
