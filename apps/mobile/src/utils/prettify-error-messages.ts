export function prettifyErrorMessages(error: string | Error) {
  const msg = typeof error === "string" ? error : error.message;

  if (msg.toLowerCase() === 'send failed') {
    return 'Please connect or reconnect your PhotosynQ device.';
  }
  if (msg.toLowerCase() === 'device not found') {
    return 'Please connect or reconnect your PhotosynQ device.';
  }

  if (msg.toLowerCase().includes('closed or timeout')) {
    return 'Connection failed.\nPlease put your device into connection mode by pressing the button on the back or select another device.';
  }

  return msg
}
