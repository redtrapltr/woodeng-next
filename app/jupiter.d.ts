interface Window {
  Jupiter: {
    init: (config: Record<string, unknown>) => void;
    syncProps: (props: Record<string, unknown>) => void;
    resume: () => void;
    close: () => void;
  };
}
