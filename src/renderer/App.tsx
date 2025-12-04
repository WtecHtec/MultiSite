import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import WorkflowManager from './pages/WorkflowManager';
import PageWorkflowManager from './pages/PageWorkflowManager';
import RunnerPage from './pages/RunnerPage';
import Layout from './components/Layout';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<WorkflowManager />} />
          <Route path="/page-workflows" element={<PageWorkflowManager />} />
          <Route path="/execution" element={<div>Execution Page (Deprecated)</div>} />
        </Route>
        <Route path="/runner" element={<RunnerPage />} />
      </Routes>
    </Router>
  );
}
