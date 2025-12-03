
import React, { useEffect, useState } from 'react';
import { SavedProject } from '../types';
import { getProjects, deleteProject } from '../db';
import { Trash2, FolderOpen, Archive, X, FileImage, Calendar } from 'lucide-react';
import JSZip from 'jszip';
import { renderMapToBlob } from '../utils';

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadProject: (project: SavedProject) => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ isOpen, onClose, onLoadProject }) => {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const list = await getProjects();
      setProjects(list);
    } catch (e) {
      console.error(e);
      alert('Errore caricamento progetti');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Sei sicuro di voler eliminare questo progetto?')) {
      await deleteProject(id);
      loadProjects();
    }
  };

  const handleArchive = async (project: SavedProject, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
        const zip = new JSZip();
        
        // Add JSON
        const jsonContent = JSON.stringify({
            version: project.version,
            planName: project.planName,
            floor: project.floor,
            imageName: project.imageName,
            rotation: project.rotation,
            points: project.points
        }, null, 2);
        zip.file(`${project.planName}.json`, jsonContent);

        // Add Base Image (Source)
        // Convert Base64 to Blob
        const fetchRes = await fetch(project.imageData);
        const blob = await fetchRes.blob();
        zip.file(project.imageName || 'image.png', blob);

        // Add Rendered Map Image (with markers)
        // We reuse the utility to generate it from the stored data
        const mapBlob = await renderMapToBlob(project.imageData, project.points, project.markerScale || 1);
        if (mapBlob) {
            zip.file(`${project.planName}_mappa.jpg`, mapBlob);
        }

        // Generate Zip
        const content = await zip.generateAsync({ type: "blob" });
        
        // Download
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.planName}_archive.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error(err);
        alert('Errore durante la creazione dell\'archivio');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-blue-600" />
            I Miei Progetti
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-100">
          {loading ? (
            <div className="flex justify-center p-8 text-slate-500">Caricamento...</div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <FileImage className="w-16 h-16 mb-4 opacity-50" />
                <p>Nessun progetto salvato in locale.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => (
                <div 
                    key={p.id} 
                    onClick={() => onLoadProject(p)}
                    className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group overflow-hidden flex flex-col"
                >
                  <div className="h-32 bg-slate-200 relative overflow-hidden">
                      <img src={p.imageData} alt="Preview" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                         <span className="text-white text-xs font-mono">{p.points.length} Punti</span>
                      </div>
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <h3 className="font-bold text-slate-800 truncate" title={p.planName}>{p.planName || 'Senza Nome'}</h3>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(p.lastModified).toLocaleDateString()} {new Date(p.lastModified).toLocaleTimeString()}
                    </div>
                    {p.floor && <div className="text-xs text-slate-600 mt-1">Piano: {p.floor}</div>}
                    
                    <div className="mt-4 flex gap-2 justify-end">
                       <button 
                         onClick={(e) => handleArchive(p, e)}
                         className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded" 
                         title="Scarica ZIP"
                        >
                           <Archive className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={(e) => handleDelete(p.id!, e)}
                         className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" 
                         title="Elimina"
                        >
                           <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
