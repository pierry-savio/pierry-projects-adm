import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { auth } from './firebase-config.js';
import type { Project, ProjectFormData, ImageInputMode, ValidationResult } from './types.js';
import { getProjects, createProject, updateProject, deleteProject, findProjectById } from './firestore.js';

// ==========================================
// Referências do DOM
// ==========================================
const dom = {
  bubblesContainer: document.getElementById('bubbles-container') as HTMLDivElement,
  counterText: document.getElementById('counter-text') as HTMLSpanElement,
  btnOpenCreateModal: document.getElementById('btn-open-create-modal') as HTMLButtonElement,
  searchInput: document.getElementById('search-input') as HTMLInputElement,
  loadingState: document.getElementById('loading-state') as HTMLElement,
  projectsGrid: document.getElementById('projects-grid') as HTMLElement,
  emptyState: document.getElementById('empty-state') as HTMLElement,
  btnEmptyAction: document.getElementById('btn-empty-action') as HTMLButtonElement,
  
  // Modal de Criação / Edição
  projectModal: document.getElementById('project-modal') as HTMLElement,
  modalTitle: document.getElementById('modal-title') as HTMLElement,
  btnCloseModal: document.getElementById('btn-close-modal') as HTMLButtonElement,
  btnCancelForm: document.getElementById('btn-cancel-form') as HTMLButtonElement,
  projectForm: document.getElementById('project-form') as HTMLFormElement,
  btnSaveProject: document.getElementById('btn-save-project') as HTMLButtonElement,
  btnSaveText: document.getElementById('btn-save-text') as HTMLSpanElement,
  projectIdInput: document.getElementById('project-id') as HTMLInputElement,
  projectNameInput: document.getElementById('project-name') as HTMLInputElement,
  projectDescInput: document.getElementById('project-description') as HTMLTextAreaElement,
  projectLinkInput: document.getElementById('project-link') as HTMLInputElement,
  charCounter: document.getElementById('char-counter') as HTMLSpanElement,
  
  // Imagem & Tabs
  tabModeFile: document.getElementById('tab-mode-file') as HTMLButtonElement,
  tabModeUrl: document.getElementById('tab-mode-url') as HTMLButtonElement,
  fileWrapper: document.getElementById('file-input-wrapper') as HTMLElement,
  urlWrapper: document.getElementById('url-input-wrapper') as HTMLElement,
  inputFileImage: document.getElementById('input-file-image') as HTMLInputElement,
  inputUrlImage: document.getElementById('input-url-image') as HTMLInputElement,
  imagePreview: document.getElementById('image-preview') as HTMLImageElement,
  previewPlaceholder: document.getElementById('preview-placeholder') as HTMLElement,
  
  // Mensagens de Erro
  errorName: document.getElementById('error-name') as HTMLSpanElement,
  errorDesc: document.getElementById('error-description') as HTMLSpanElement,
  errorLink: document.getElementById('error-link') as HTMLSpanElement,
  errorImage: document.getElementById('error-image') as HTMLSpanElement,
  
  // Modal de Exclusão
  confirmModal: document.getElementById('confirm-modal') as HTMLElement,
  confirmProjectName: document.getElementById('confirm-project-name') as HTMLElement,
  btnCloseConfirm: document.getElementById('btn-close-confirm') as HTMLButtonElement,
  btnCancelDelete: document.getElementById('btn-cancel-delete') as HTMLButtonElement,
  btnConfirmDelete: document.getElementById('btn-confirm-delete') as HTMLButtonElement,
  
  toastContainer: document.getElementById('toast-container') as HTMLElement,
};

// ==========================================
// Estado da Aplicação
// ==========================================
let projectsCache: Project[] = [];
let currentImageBase64: string = '';
let currentImageMode: ImageInputMode = 'file';
let projectPendingDeletionId: string | null = null;
let activeSearchQuery: string = '';

// ==========================================
// Efeito de Bolhas Flutuantes
// ==========================================
function initAeroBubbles(): void {
  if (!dom.bubblesContainer) return;
  const bubbleCount = 14;

  for (let i = 0; i < bubbleCount; i++) {
    const bubble = document.createElement('div');
    bubble.classList.add('bubble');

    const size = Math.floor(Math.random() * 55) + 20;
    const left = Math.random() * 100;
    const duration = Math.random() * 12 + 10;
    const delay = Math.random() * 8;

    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${left}%`;
    bubble.style.animationDuration = `${duration}s`;
    bubble.style.animationDelay = `${delay}s`;

    dom.bubblesContainer.appendChild(bubble);
  }
}

// ==========================================
// Notificações Toast
// ==========================================
function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✨' : '⚠️'}</span>
    <span>${escapeHtml(message)}</span>
  `;

  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function isValidHttpUrl(stringUrl: string): boolean {
  try {
    const url = new URL(stringUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// ==========================================
// Carregamento & Renderização
// ==========================================
async function fetchAndRenderProjects(): Promise<void> {
  try {
    dom.loadingState.classList.remove('hidden');
    dom.emptyState.classList.add('hidden');
    
    projectsCache = await getProjects();
    renderProjectList();
  } catch (err) {
    showToast('Falha ao sincronizar com o Firestore. Verifique as credenciais.', 'error');
  } finally {
    dom.loadingState.classList.add('hidden');
  }
}

function renderProjectList(): void {
  const queryText = activeSearchQuery.toLowerCase().trim();

  const filtered = projectsCache.filter(p => 
    p.name.toLowerCase().includes(queryText) || 
    p.description.toLowerCase().includes(queryText)
  );

  dom.counterText.textContent = `${projectsCache.length} ${projectsCache.length === 1 ? 'projeto' : 'projetos'}`;

  if (filtered.length === 0) {
    dom.projectsGrid.innerHTML = '';
    dom.emptyState.classList.remove('hidden');
    return;
  }

  dom.emptyState.classList.add('hidden');
  dom.projectsGrid.innerHTML = filtered.map(project => `
    <article class="project-card" data-id="${project.id}">
      <div class="card-media">
        <img 
          src="${escapeHtml(project.image)}" 
          alt="${escapeHtml(project.name)}" 
          loading="lazy"
          onerror="this.src='https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80'"
        />
        <div class="media-overlay-gradient"></div>
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(project.name)}</h3>
        <p class="card-desc">${escapeHtml(project.description)}</p>
        <div class="card-actions">
          <a 
            href="${escapeHtml(project.link)}" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="btn btn-glossy btn-primary"
            title="Abrir página externa"
          >
            Acessar Link
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
          <div class="manage-btns">
            <button 
              type="button" 
              class="btn btn-glossy btn-secondary btn-action-icon btn-edit" 
              data-id="${project.id}" 
              aria-label="Editar projeto ${escapeHtml(project.name)}"
              title="Editar"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button 
              type="button" 
              class="btn btn-glossy btn-danger btn-action-icon btn-delete" 
              data-id="${project.id}" 
              aria-label="Excluir projeto ${escapeHtml(project.name)}"
              title="Excluir"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </article>
  `).join('');
}

// ==========================================
// Gerenciamento dos Modais
// ==========================================
function openCreateModal(): void {
  resetForm();
  dom.modalTitle.textContent = 'Adicionar Novo Projeto';
  dom.btnSaveText.textContent = 'Salvar no Firestore';
  dom.projectModal.classList.remove('hidden');
  dom.projectNameInput.focus();
}

async function openEditModal(id: string): Promise<void> {
  resetForm();
  
  // Tenta pegar do cache ou diretamente do Firestore
  let project = projectsCache.find(p => p.id === id);
  if (!project) {
    project = (await findProjectById(id)) ?? undefined;
  }

  if (!project) {
    showToast('Projeto não localizado.', 'error');
    return;
  }

  dom.modalTitle.textContent = 'Editar Projeto na Nuvem';
  dom.btnSaveText.textContent = 'Atualizar Projeto';
  dom.projectIdInput.value = project.id;
  dom.projectNameInput.value = project.name;
  dom.projectDescInput.value = project.description;
  dom.projectLinkInput.value = project.link;
  dom.charCounter.textContent = String(project.description.length);

  currentImageBase64 = project.image;
  setPreviewImage(project.image);

  if (project.image.startsWith('data:image')) {
    setImageMode('file');
  } else {
    setImageMode('url');
    dom.inputUrlImage.value = project.image;
  }

  dom.projectModal.classList.remove('hidden');
}

function closeProjectModal(): void {
  dom.projectModal.classList.add('hidden');
  resetForm();
}

function openConfirmDeleteModal(id: string): void {
  const project = projectsCache.find(p => p.id === id);
  if (!project) return;

  projectPendingDeletionId = id;
  dom.confirmProjectName.textContent = `"${project.name}"`;
  dom.confirmModal.classList.remove('hidden');
}

function closeConfirmDeleteModal(): void {
  dom.confirmModal.classList.add('hidden');
  projectPendingDeletionId = null;
}

// ==========================================
// Lógica de Imagem & Preview
// ==========================================
function setImageMode(mode: ImageInputMode): void {
  currentImageMode = mode;
  if (mode === 'file') {
    dom.tabModeFile.classList.add('active');
    dom.tabModeUrl.classList.remove('active');
    dom.fileWrapper.classList.remove('hidden');
    dom.urlWrapper.classList.add('hidden');
  } else {
    dom.tabModeUrl.classList.add('active');
    dom.tabModeFile.classList.remove('active');
    dom.urlWrapper.classList.remove('hidden');
    dom.fileWrapper.classList.add('hidden');
  }
}

function setPreviewImage(src: string): void {
  if (src && src.trim() !== '') {
    dom.imagePreview.src = src;
    dom.imagePreview.classList.remove('hidden');
    dom.previewPlaceholder.classList.add('hidden');
  } else {
    dom.imagePreview.src = '';
    dom.imagePreview.classList.add('hidden');
    dom.previewPlaceholder.classList.remove('hidden');
  }
}

function handleFileUpload(e: Event): void {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Selecione um arquivo de imagem válido.', 'error');
    return;
  }

  if (file.size > 1024 * 1024) { // 1MB limite para documentos Firestore
    showToast('A imagem excede 1MB. Use uma imagem mais leve ou um link URL.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result as string;
    currentImageBase64 = result;
    setPreviewImage(result);
    dom.errorImage.classList.remove('visible');
  };
  reader.readAsDataURL(file);
}

function handleUrlImageInput(): void {
  const url = dom.inputUrlImage.value.trim();
  if (isValidHttpUrl(url)) {
    currentImageBase64 = url;
    setPreviewImage(url);
    dom.errorImage.classList.remove('visible');
  } else if (url === '') {
    currentImageBase64 = '';
    setPreviewImage('');
  }
}

// ==========================================
// Validação & Submissão Assíncrona
// ==========================================
function validateForm(): ValidationResult {
  const errors: Partial<Record<keyof ProjectFormData, string>> = {};
  const name = dom.projectNameInput.value.trim();
  const desc = dom.projectDescInput.value.trim();
  const link = dom.projectLinkInput.value.trim();

  if (name.length < 3) errors.name = 'O nome deve ter no mínimo 3 caracteres.';
  if (desc.length < 10) errors.description = 'A descrição deve ter ao menos 10 caracteres.';
  if (!isValidHttpUrl(link)) errors.link = 'Insira uma URL válida (ex: https://site.com).';
  if (!currentImageBase64) errors.image = 'A imagem do projeto é obrigatória.';

  dom.errorName.classList.toggle('visible', !!errors.name);
  dom.projectNameInput.classList.toggle('invalid', !!errors.name);

  dom.errorDesc.classList.toggle('visible', !!errors.description);
  dom.projectDescInput.classList.toggle('invalid', !!errors.description);

  dom.errorLink.classList.toggle('visible', !!errors.link);
  dom.projectLinkInput.classList.toggle('invalid', !!errors.link);

  dom.errorImage.classList.toggle('visible', !!errors.image);

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

function resetForm(): void {
  dom.projectForm.reset();
  dom.projectIdInput.value = '';
  currentImageBase64 = '';
  setPreviewImage('');
  setImageMode('file');
  dom.charCounter.textContent = '0';

  [dom.errorName, dom.errorDesc, dom.errorLink, dom.errorImage].forEach(el => el.classList.remove('visible'));
  [dom.projectNameInput, dom.projectDescInput, dom.projectLinkInput].forEach(el => el.classList.remove('invalid'));
}

async function handleFormSubmit(e: Event): Promise<void> {
  e.preventDefault();
  const validation = validateForm();
  if (!validation.isValid) return;

  const id = dom.projectIdInput.value;
  const projectData: ProjectFormData = {
    name: dom.projectNameInput.value.trim(),
    description: dom.projectDescInput.value.trim(),
    link: dom.projectLinkInput.value.trim(),
    image: currentImageBase64
  };

  try {
    dom.btnSaveProject.disabled = true;
    dom.btnSaveText.textContent = 'Gravando na nuvem...';

    if (id) {
      await updateProject(id, projectData);
      showToast(`Projeto "${projectData.name}" atualizado com sucesso!`);
    } else {
      await createProject(projectData);
      showToast(`Projeto "${projectData.name}" salvo no Firestore!`);
    }

    closeProjectModal();
    await fetchAndRenderProjects();
  } catch (error) {
    showToast('Erro ao salvar no Firestore. Verifique suas regras de segurança.', 'error');
  } finally {
    dom.btnSaveProject.disabled = false;
  }
}

async function handleConfirmDelete(): Promise<void> {
  if (!projectPendingDeletionId) return;

  try {
    dom.btnConfirmDelete.disabled = true;
    dom.btnConfirmDelete.textContent = 'Excluindo...';

    await deleteProject(projectPendingDeletionId);
    closeConfirmDeleteModal();
    showToast('Projeto removido do Firestore.');
    await fetchAndRenderProjects();
  } catch (err) {
    showToast('Erro ao remover o projeto da nuvem.', 'error');
  } finally {
    dom.btnConfirmDelete.disabled = false;
    dom.btnConfirmDelete.textContent = 'Sim, Excluir';
  }
}

// ==========================================
// Event Listeners
// ==========================================
function bindEvents(): void {
  dom.btnOpenCreateModal.addEventListener('click', openCreateModal);
  dom.btnEmptyAction.addEventListener('click', openCreateModal);

  dom.btnCloseModal.addEventListener('click', closeProjectModal);
  dom.btnCancelForm.addEventListener('click', closeProjectModal);
  dom.btnCloseConfirm.addEventListener('click', closeConfirmDeleteModal);
  dom.btnCancelDelete.addEventListener('click', closeConfirmDeleteModal);

  [dom.projectModal, dom.confirmModal].forEach(modalEl => {
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) {
        closeProjectModal();
        closeConfirmDeleteModal();
      }
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProjectModal();
      closeConfirmDeleteModal();
    }
  });

  dom.tabModeFile.addEventListener('click', () => setImageMode('file'));
  dom.tabModeUrl.addEventListener('click', () => setImageMode('url'));

  dom.inputFileImage.addEventListener('change', handleFileUpload);
  dom.inputUrlImage.addEventListener('input', handleUrlImageInput);

  dom.projectDescInput.addEventListener('input', () => {
    dom.charCounter.textContent = String(dom.projectDescInput.value.length);
  });

  dom.projectForm.addEventListener('submit', handleFormSubmit);
  dom.btnConfirmDelete.addEventListener('click', handleConfirmDelete);

  dom.searchInput.addEventListener('input', (e) => {
    activeSearchQuery = (e.target as HTMLInputElement).value;
    renderProjectList();
  });

  dom.projectsGrid.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    
    const editBtn = target.closest('.btn-edit') as HTMLButtonElement | null;
    if (editBtn && editBtn.dataset.id) {
      await openEditModal(editBtn.dataset.id);
      return;
    }

    const deleteBtn = target.closest('.btn-delete') as HTMLButtonElement | null;
    if (deleteBtn && deleteBtn.dataset.id) {
      openConfirmDeleteModal(deleteBtn.dataset.id);
      return;
    }
  });
}

// ==========================================
// Inicialização
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initAeroBubbles();
  bindEvents();
});

// Elementos da tela de Login
const authScreen = document.getElementById('auth-screen') as HTMLElement;
const loginForm = document.getElementById('login-form') as HTMLFormElement;
const loginEmail = document.getElementById('login-email') as HTMLInputElement;
const loginPassword = document.getElementById('login-password') as HTMLInputElement;
const loginError = document.getElementById('login-error') as HTMLElement;
const btnLogout = document.getElementById('btn-logout') as HTMLButtonElement;
const mainViewport = document.querySelector('.main-viewport') as HTMLElement;

// Monitora o estado de autenticação em tempo real
onAuthStateChanged(auth, (user) => {
  if (user) {
    // 1. Usuário autenticado com sucesso!
    authScreen.style.display = 'none';
    mainViewport.style.display = 'block';
    btnLogout.style.display = 'inline-flex';
    
    // Agora sim: buscamos os dados com permissão total!
    fetchAndRenderProjects();
  } else {
    // 2. Não autenticado: mostra a tela de bloqueio
    authScreen.style.display = 'flex';
    mainViewport.style.display = 'none';
    btnLogout.style.display = 'none';
  }
});

// Ação de Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.remove('visible');

  try {
    await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
    loginForm.reset();
  } catch (error) {
    loginError.classList.add('visible');
  }
});

// Ação de Sair (Logout)
btnLogout.addEventListener('click', async () => {
  await signOut(auth);
});