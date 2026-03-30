import { RouterProvider, createBrowserRouter, createRoutesFromElements, Navigate, Route } from "react-router-dom";
import AppShell from "./app/AppShell";
import { PublicOnly, RequireAuth } from "./app/components/common";
import { AppProvider } from "./app/context";
import { LoginPage, RegisterPage, SsoStatusPage } from "./app/pages/auth";
import DashboardPage from "./app/pages/dashboard";
import EditorPage from "./app/pages/editor";
import ProjectPage from "./app/pages/project";
import SettingsPage from "./app/pages/settings";

function App() {
  return (
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/sso-status" element={<SsoStatusPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/projects/:projectId/languages/:languageCode/edit" element={<EditorPage />} />
          <Route path="/settings/:tab?" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </>
  ),
);

export default App;
