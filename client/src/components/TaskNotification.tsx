import { Alert, CircularProgress, Snackbar } from '@mui/material';
import { dismissTaskError, usePendingTask } from '../utils/pendingTask';

export default function TaskNotification() {
  const { pending, error } = usePendingTask();
  return (
    <Snackbar
      open={Boolean(pending || error)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      autoHideDuration={pending ? null : 6000}
      onClose={pending ? undefined : dismissTaskError}
    >
      {pending ? (
        <Alert severity="info" icon={<CircularProgress size={20} color="inherit" />} role="status" aria-live="polite">
          {pending}
        </Alert>
      ) : (
        <Alert severity="error" onClose={dismissTaskError}>{error}</Alert>
      )}
    </Snackbar>
  );
}
