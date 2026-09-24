import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from './firebase-config.js';
import type { Project, ProjectFormData } from './types.js';

const COLLECTION_NAME = 'projects';

/**
 * Busca todos os projetos salvos no Firestore, ordenados pelos mais recentes.
 */
export async function getProjects(): Promise<Project[]> {
  try {
    const projectsCol = collection(db, COLLECTION_NAME);
    const q = query(projectsCol, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const projects: Project[] = [];
    snapshot.forEach(docSnapshot => {
      const data = docSnapshot.data();
      projects.push({
        id: docSnapshot.id,
        name: data.name ?? '',
        description: data.description ?? '',
        link: data.link ?? '',
        image: data.image ?? '',
        createdAt: data.createdAt ?? Date.now()
      });
    });

    return projects;
  } catch (error) {
    console.error('Erro ao buscar projetos no Firestore:', error);
    throw error;
  }
}

/**
 * Cria um novo projeto no Firestore.
 */
export async function createProject(data: ProjectFormData): Promise<Project> {
  try {
    const createdAt = Date.now();
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      createdAt
    });

    return {
      id: docRef.id,
      ...data,
      createdAt
    };
  } catch (error) {
    console.error('Erro ao criar projeto no Firestore:', error);
    throw error;
  }
}

/**
 * Atualiza um projeto existente no Firestore.
 */
export async function updateProject(id: string, data: Partial<ProjectFormData>): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, { ...data });
  } catch (error) {
    console.error(`Erro ao atualizar projeto ${id} no Firestore:`, error);
    throw error;
  }
}

/**
 * Exclui um projeto no Firestore pelo ID.
 */
export async function deleteProject(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Erro ao deletar projeto ${id} no Firestore:`, error);
    throw error;
  }
}

/**
 * Encontra um projeto específico pelo seu ID no Firestore.
 */
export async function findProjectById(id: string): Promise<Project | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name ?? '',
      description: data.description ?? '',
      link: data.link ?? '',
      image: data.image ?? '',
      createdAt: data.createdAt ?? Date.now()
    };
  } catch (error) {
    console.error(`Erro ao buscar projeto ${id}:`, error);
    return null;
  }
}