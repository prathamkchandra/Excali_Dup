import type { Shape } from "./Shape";
import type { Camera } from "@/app/utils/camera";

export type Drawing = {
  id: string;
  name: string;
  shapes: Shape[];
  camera: Camera;
  zoom?: number;
  createdAt: number;
  updatedAt: number;
};
