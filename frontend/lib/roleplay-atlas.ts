/** Geographic coordinates on a Natural Earth equirectangular crop; the campaign strokes are schematic, not borders. */
export type GeoPoint = readonly [longitude: number, latitude: number];
export const ATLAS_BOUNDS = { west: 10, east: 150, north: 70, south: 5, width: 1400, height: 650 } as const;
export const geoPoint = ([lon, lat]: GeoPoint): [number, number] => [(lon - ATLAS_BOUNDS.west) * 10, (ATLAS_BOUNDS.north - lat) * 10];
export const geoPath = (points: readonly GeoPoint[], close = false): string => points.map((point, i) => `${i ? 'L' : 'M'}${geoPoint(point).map(n => Number(n.toFixed(2))).join(',')}`).join(' ') + (close ? ' Z' : '');
export interface AtlasPlace { id: string; name: string; at: GeoPoint; text: string; kind: 'origin' | 'city' | 'battle' | 'home'; year: number }
export const ATLAS_PLACES: readonly AtlasPlace[] = [
  { id: 'mongolia', name: 'Cao nguyên Mông Cổ', at: [103.8, 48], kind: 'origin', year: 1206, text: 'Năm 1206, Thiết Mộc Chân được tôn làm Thành Cát Tư Hãn sau khi thống nhất các bộ lạc Mông Cổ. Đây là điểm mở đầu của câu chuyện.' },
  { id: 'samarkand', name: 'Samarkand', at: [66.97, 39.65], kind: 'city', year: 1220, text: 'Chiến dịch đánh Khwarezm năm 1219–1221 đưa quân Mông Cổ tới nhiều thành thị Trung Á. Samarkand thất thủ năm 1220.' },
  { id: 'kalka', name: 'Sông Kalka · khu vực ước lệ', at: [37.5, 47.2], kind: 'battle', year: 1223, text: 'Năm 1223, liên quân các công quốc Rus’ và người Cuman bị quân Mông Cổ đánh bại ở sông Kalka. Vị trí chính xác của chiến trường còn có ý kiến khác nhau; vòng tròn chỉ khu vực khái quát.' },
  { id: 'moscow', name: 'Mạc Tư Khoa (Moscow)', at: [37.62, 55.75], kind: 'city', year: 1238, text: 'Mạc Tư Khoa bị quân Mông Cổ đánh chiếm năm 1238, trong chiến dịch do Batu chỉ huy. Thành Cát Tư Hãn đã mất năm 1227.' },
  { id: 'kyiv', name: 'Kyiv (Kiev)', at: [30.52, 50.45], kind: 'city', year: 1240, text: 'Kyiv thất thủ và bị tàn phá năm 1240. Các công quốc Rus’ thời trung đại không đồng nhất với riêng nước Nga hiện nay; Kyiv ngày nay thuộc Ukraine.' },
  { id: 'dai-ly', name: 'Đại Lý', at: [100.23, 25.6], kind: 'city', year: 1257, text: 'Vùng phía bắc Đại Việt là bàn đạp của cuộc tiến quân Mông Cổ năm 1258. Mũi tên trong đoạn dẫn chỉ hướng khái quát, không phải tuyến hành quân đo đạc chính xác.' },
  { id: 'dai-viet', name: 'Đại Việt · Thăng Long', at: [105.85, 21.03], kind: 'home', year: 1257, text: 'Cuối năm 1257, nhà Trần chuẩn bị đối phó quân xâm lược. Bước vào năm 1258, vua Trần Thái Tông cùng quân dân Đại Việt tổ chức kháng chiến.' },
];
export const findAtlasPlace = (id: string): AtlasPlace | undefined => ATLAS_PLACES.find(place => place.id === id);
export const ATLAS_ROUTES: Record<string, readonly GeoPoint[]> = {
  west: [[103.8,48],[91,46],[80,44],[70,42],[66.97,39.65]],
  kalka: [[66.97,39.65],[58,40],[49,37],[45,41.5],[42,44],[37.5,47.2]],
  moscow: [[50,53],[45,55],[40,55.5],[37.62,55.75]],
  kyiv: [[37.62,55.75],[34,53],[32,51],[30.52,50.45]],
  daiViet: [[100.23,25.6],[102,24.3],[104,22.8],[105.85,21.03]],
};
export const ATLAS_REGIONS: readonly { from: number; points: readonly GeoPoint[] }[] = [
  { from:1206, points:[[91,46],[94,50],[100,53],[110,52],[118,48],[116,43],[107,42],[99,44]] },
  { from:1219, points:[[94,50],[83,50],[73,47],[64,45],[58,42],[60,36],[68,35],[77,39],[89,43],[99,44]] },
];
export const ATLAS_CAMERA: Record<string, readonly [x: number, y: number, width: number, height: number]> = {
  foundation:[650,10,700,394], west:[180,30,1100,619], kalka:[100,60,650,366], moscow:[125,30,500,281], kyiv:[55,65,500,281],
  warning:[760,300,450,253], first:[800,365,350,197], later:[780,340,400,225], mission:[800,365,350,197],
};
/** SVG and Canvas use the same polyline interpolation, including the final endpoint. */
export function routePosition(points: readonly GeoPoint[], progress: number): [number, number] {
  if (!points.length) return [0,0];
  const projected = points.map(geoPoint), lengths = projected.slice(1).map((point,i) => Math.hypot(point[0]-projected[i][0],point[1]-projected[i][1]));
  let distance = lengths.reduce((sum,n) => sum+n,0) * Math.max(0,Math.min(1,progress));
  for (let i=0;i<lengths.length;i++) { if (distance<=lengths[i] || i===lengths.length-1) { const t=lengths[i] ? distance/lengths[i] : 0; return [projected[i][0]+(projected[i+1][0]-projected[i][0])*t,projected[i][1]+(projected[i+1][1]-projected[i][1])*t]; } distance-=lengths[i]; }
  return projected[0];
}
