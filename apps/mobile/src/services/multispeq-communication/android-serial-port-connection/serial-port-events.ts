export interface SerialPortEvents {
  dataReceivedFromDevice: string;
  sendDataToDevice: string;
  destroy: void;
}
