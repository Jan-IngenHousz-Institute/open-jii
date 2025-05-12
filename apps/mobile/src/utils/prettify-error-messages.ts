export function prettifyErrorMessages(error: string | Error) {
  const msg = typeof error === "string" ? error : error.message;

  if (msg.toLowerCase() === 'send failed') {
    return 'Please connect or reconnect your PhotosynQ device.';
  }

  return msg
}
