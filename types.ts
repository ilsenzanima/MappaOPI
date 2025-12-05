
export type InteractionMode = 'pan' | 'add' | 'move' | 'line';

export type PointType = 'generic' | 'floor-single' | 'wall-single' | 'floor-multi' | 'wall-multi';

export type LineColor = '#dc2626' | '#2563eb' | '#06b6d4' | '#16a34a' | '#f97316'; // Red, Blue, Cyan, Green, Orange

export interface MapPoint {
  id: string;
  number: number; // The visual number (1, 2, 3...)
  x: number; // Percentage relative to image width (0-100) - THIS IS THE BADGE POSITION
  y: number; // Percentage relative to image height (0-100)
  targetX?: number; // Percentage relative to image width (0-100) - THIS IS THE OBJECT POSITION (Arrow tip)
  targetY?: number;
  type: PointType;
  description: string;
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
  rotation: number; // Rotation in degrees
  markerScale: number; // Scale factor for markers (0.5 to 3.0)
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
