import { useState, useEffect, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Firm, Project } from '../types';

interface FirmContextType {
  selectedFirm: Firm | null;
  firms: Firm[];
  setSelectedFirm: (firm: Firm | null) => void;
  selectedProject: Project | null;
  projects: Project[];
  setSelectedProject: (project: Project | null) => void;
  loading: boolean;
}

const FirmContext = createContext<FirmContextType | undefined>(undefined);

export function FirmProvider({ children }: { children: ReactNode }) {
  const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFirms();
    
    // LocalStorage'dan son seçili firmayı al
    const savedFirmId = localStorage.getItem('selectedFirmId');
    if (savedFirmId) {
      const savedFirm = firms.find(f => f.id === savedFirmId);
      if (savedFirm) setSelectedFirm(savedFirm);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [selectedFirm]);

  const fetchFirms = async () => {
    const { data } = await supabase.from('firms').select('*').eq('is_active', true).eq('type', 'both').order('code');
    if (data) {
      setFirms(data);
      
      // LocalStorage'dan son seçili firmayı al
      const savedFirmId = localStorage.getItem('selectedFirmId');
      if (savedFirmId) {
        const savedFirm = data.find(f => f.id === savedFirmId);
        if (savedFirm) setSelectedFirm(savedFirm);
      }
    }
    setLoading(false);
  };

  const fetchProjects = async () => {
    let query = supabase.from('projects').select('*').eq('status', 'active').order('name');
    
    // Firma seçiliyse sadece o firmaya ait projeleri göster
    if (selectedFirm) {
      query = query.eq('firm_id', selectedFirm.id);
    }
    
    const { data } = await query;
    if (data) {
      setProjects(data);
      
      // LocalStorage'dan son seçili projeyi al
      const savedProjectId = localStorage.getItem('selectedProjectId');
      if (savedProjectId) {
        const savedProject = data.find(p => p.id === savedProjectId);
        if (savedProject) {
          setSelectedProject(savedProject);
        } else if (selectedProject && !data.some(p => p.id === selectedProject.id)) {
          // Seçili proje bu firmada yoksa sıfırla
          setSelectedProject(null);
          localStorage.removeItem('selectedProjectId');
        }
      } else if (selectedProject && !data.some(p => p.id === selectedProject.id)) {
        setSelectedProject(null);
        localStorage.removeItem('selectedProjectId');
      }
    }
  };

  const handleSetSelectedFirm = (firm: Firm | null) => {
    setSelectedFirm(firm);
    // Firma değişince projeyi sıfırlama - sadece yeni firmada yoksa sıfırla
    if (firm) {
      localStorage.setItem('selectedFirmId', firm.id);
    } else {
      localStorage.removeItem('selectedFirmId');
      setSelectedProject(null);
      localStorage.removeItem('selectedProjectId');
    }
  };

  const handleSetSelectedProject = (project: Project | null) => {
    setSelectedProject(project);
    if (project) {
      localStorage.setItem('selectedProjectId', project.id);
    } else {
      localStorage.removeItem('selectedProjectId');
    }
  };

  return (
    <FirmContext.Provider value={{ 
      selectedFirm, 
      firms, 
      setSelectedFirm: handleSetSelectedFirm, 
      selectedProject,
      projects,
      setSelectedProject: handleSetSelectedProject,
      loading 
    }}>
      {children}
    </FirmContext.Provider>
  );
}

export function useFirm() {
  const context = useContext(FirmContext);
  if (context === undefined) {
    throw new Error('useFirm must be used within a FirmProvider');
  }
  return context;
}
