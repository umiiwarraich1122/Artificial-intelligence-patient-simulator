import { useApp } from '../context/AppContext';

export default function Toast() {
  const { toast } = useApp();
  return (
    <div id="toast" className={`toast-notification${toast.visible ? ' show' : ''}${toast.isError ? ' error' : ''}`}>
      <span id="toastMessage">{toast.message}</span>
    </div>
  );
}
