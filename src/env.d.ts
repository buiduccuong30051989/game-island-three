// Module ảo do vite.config.ts sinh: ảnh gia đình có trong public/family/ ({ 'me-yen': 'me-yen.jpg', ... }).
declare module 'virtual:family-photos' {
  const photos: Record<string, string>;
  export default photos;
}
