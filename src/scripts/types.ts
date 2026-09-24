export interface Project {
  id: string;
  name: string;
  description: string;
  link: string;
  image: string;
  createdAt: number;
}

export type ProjectFormData = Omit<Project, 'id' | 'createdAt'>;

export type ImageInputMode = 'file' | 'url';

export interface ValidationResult {
  isValid: boolean;
  errors: Partial<Record<keyof ProjectFormData, string>>;
}