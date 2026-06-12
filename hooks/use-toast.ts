'use client';
import * as React from 'react';
import type { ToastProps } from '@/components/ui/toast';

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1_000_000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactElement;
};

let count = 0;
function genId() { count = (count + 1) % Number.MAX_SAFE_INTEGER; return count.toString(); }

type State = { toasts: ToasterToast[] };

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(action: { type: 'ADD_TOAST'; toast: ToasterToast } | { type: 'UPDATE_TOAST'; toast: Partial<ToasterToast> } | { type: 'DISMISS_TOAST'; toastId?: string } | { type: 'REMOVE_TOAST'; toastId?: string }) {
  memoryState = reducer(memoryState, action);
  listeners.forEach(listener => listener(memoryState));
}

function reducer(state: State, action: { type: string; toast?: Partial<ToasterToast>; toastId?: string }): State {
  switch (action.type) {
    case 'ADD_TOAST':
      return { ...state, toasts: [action.toast as ToasterToast, ...state.toasts].slice(0, TOAST_LIMIT) };
    case 'UPDATE_TOAST':
      return { ...state, toasts: state.toasts.map(t => t.id === action.toast?.id ? { ...t, ...action.toast } : t) };
    case 'DISMISS_TOAST': {
      const id = action.toastId;
      if (id) {
        setTimeout(() => dispatch({ type: 'REMOVE_TOAST', toastId: id }), TOAST_REMOVE_DELAY);
      } else {
        state.toasts.forEach(t => setTimeout(() => dispatch({ type: 'REMOVE_TOAST', toastId: t.id }), TOAST_REMOVE_DELAY));
      }
      return { ...state, toasts: state.toasts.map(t => (!id || t.id === id) ? { ...t, open: false } : t) };
    }
    case 'REMOVE_TOAST':
      return { ...state, toasts: action.toastId ? state.toasts.filter(t => t.id !== action.toastId) : [] };
    default:
      return state;
  }
}

function toast({ ...props }: Omit<ToasterToast, 'id'>) {
  const id = genId();
  const update = (p: ToasterToast) => dispatch({ type: 'UPDATE_TOAST', toast: { ...p, id } });
  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id });
  dispatch({
    type: 'ADD_TOAST',
    toast: { ...props, id, open: true, onOpenChange: open => { if (!open) dismiss(); } },
  });
  return { id, dismiss, update };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);
  React.useEffect(() => {
    listeners.push(setState);
    return () => { const i = listeners.indexOf(setState); if (i > -1) listeners.splice(i, 1); };
  }, [state]);
  return { ...state, toast, dismiss: (id?: string) => dispatch({ type: 'DISMISS_TOAST', toastId: id }) };
}

export { useToast, toast };
