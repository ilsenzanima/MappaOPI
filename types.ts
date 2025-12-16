
export type InteractionMode = 'pan' | 'add' | 'move' | 'line' | 'reposition';

export type PointType = 'generic' | 'floor-single' | 'wall-single' | 'floor-multi' | 'wall-multi';

export type LineColor = '#dc2626' | '#2563eb' | '#06b6d4' | '#16a34a' | '#f97316'; // Red, Blue, Cyan, Green, Orange

export interface MapPoint {
  id: string;
  number: number; // The internal sequential index (used for sorting/list)
  typology: string; // The text displayed INSIDE the marker (e.g. "1", "1,2", "A")
  x: number; // Percentage relative to image width
  y: number; // Percentage relative to image height
  targetX?: number; // Arrow tip position
  targetY?: number;
  type?: string; // Kept for backward compatibility, but not used in UI
  description: string;
  images?: string[]; // Array of base64 strings for attached photos
  createdAt: number;
}

export interface MapLine {
  id: string;
  startX: number; // Percentage
  startY: number;
  endX: number;
  endY: number;
  color: LineColor;
}

export interface ProjectState {
  version: number;
  planName: string;
  floor: string;
  imageName: string;
  rotation: number; 
  markerScale: number; 
  points: MapPoint[];
  lines: MapLine[];
}

export interface DragState {
  isDragging: boolean;
  pointId: string | null;
  startX: number;
  startY: number;
}

export interface SavedProject extends ProjectState {
  id: string;
  lastModified: number;
  imageData: string; // Base64 of the image
}
