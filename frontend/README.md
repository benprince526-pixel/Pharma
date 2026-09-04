# Pharma Inventory Frontend

Frontend React application for the Pharma Inventory Management System - Sonatrach Gassi Touil

## Features

- 🔐 Login page with French language interface
- 📊 Dashboard with inventory statistics
- 💊 Medicine inventory table with CRUD operations
- 🎨 Responsive design with green pharmacy theme
- 🚀 Real-time API integration with Spring Boot backend

## Project Structure

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── pages/
│   │   ├── LoginPage.js
│   │   └── Dashboard.js
│   ├── services/
│   │   └── api.js
│   ├── styles/
│   │   ├── LoginPage.css
│   │   └── Dashboard.css
│   ├── App.js
│   └── index.js
├── package.json
└── .gitignore
```

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Spring Boot backend running on http://localhost:8080

## Installation

1. Install dependencies:
```bash
cd frontend
npm install
```

## Running the Application

### Development Mode

```bash
npm start
```

The application will open at `http://localhost:3000`

### Build for Production

```bash
npm build
```

## API Endpoints

The frontend expects the following backend endpoints:

- `POST /api/auth/login` - User authentication
  - Request: `{ email: string, password: string }`
  - Response: `{ token: string }`

- `GET /api/medicines` - Get all medicines
- `POST /api/medicines` - Create new medicine
- `PUT /api/medicines/:id` - Update medicine
- `DELETE /api/medicines/:id` - Delete medicine

## Authentication

- Login credentials are stored in localStorage
- Authentication token is automatically added to all API requests
- Invalid/expired tokens redirect to login page

## Demo Mode

- Enter any non-empty email/password to access demo mode
- Demo mode uses sample data if backend is unavailable

## Styling

All styles are custom CSS modules with no external CSS frameworks:
- Color scheme: Green pharmacy theme (#4caf50 primary, #45a049 dark)
- Responsive design for mobile, tablet, and desktop
- Smooth animations and transitions

## Language

- All UI text is in French
- Placeholder: Sonatrach Gassi Touil branding with 🏥 emoji

## Troubleshooting

### Backend connection errors
- Ensure Spring Boot backend is running on http://localhost:8080
- Check CORS configuration on backend
- Frontend will fallback to demo mode if backend is unavailable

### Port already in use
```bash
PORT=3001 npm start
```

## License

This project is part of the Pharma Inventory Management System for Sonatrach Gassi Touil
