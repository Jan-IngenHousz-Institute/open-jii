interface BleConnectionScreenProps {
  route: {
    params: {
      deviceId: string;
    };
  };
}


export function BleConnectionScreen({ route }: BleConnectionScreenProps) {
  const { deviceId } = route.params
  console.log('deviceId', deviceId)
  return null;
}