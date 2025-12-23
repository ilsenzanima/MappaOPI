
export type InteractionMode = 'pan' | 'add' | 'move' | 'line' | 'reposition';

export type LineColor = '#dc2626' | '#2563eb' | '#06b6d4' | '#16a34a' | '#f97316';

// Exporting PointType to fix the missing member error in components/PointIcons.tsx
export type PointType = 'generic' | 'floor-single' | 'wall-single' | 'floor-multi' | 'wall-multi';

export interface MapPoint {
  id: string;
  number: number;
  typology: string;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  description: string;
  images?: string[];
  createdAt: number;
}

export interface MapLine {
  id: string;
  startX: number;
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

export interface SavedProject extends ProjectState {
  id: string;
  lastModified: number;
  imageData: string;
}