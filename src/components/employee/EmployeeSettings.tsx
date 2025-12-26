import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Settings, Lock, User, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface EmployeeSettingsProps {
  employeeId: string;
}

export function EmployeeSettings({ employeeId }: EmployeeSettingsProps) {
  const { employees, updateEmployee, currentUser } = useApp();
  const employee = employees.find(e => e.id === employeeId);
  const [open, setOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Estados para contraseña
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Estados para avatar
  const [avatarPhrase, setAvatarPhrase] = useState('');
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);

  if (!employee || !currentUser || currentUser.id !== employeeId) {
    return null;
  }

  const generateAvatarUrl = (phrase: string) => {
    if (!phrase.trim()) return null;
    // Usar DiceBear con el estilo fun-emoji, usando la frase como seed
    return `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${encodeURIComponent(phrase.trim())}`;
  };

  const handleAvatarPhraseChange = (phrase: string) => {
    setAvatarPhrase(phrase);
    const newAvatarUrl = generateAvatarUrl(phrase);
    setPreviewAvatar(newAvatarUrl);
  };

  const handleUpdateAvatar = async () => {
    if (!avatarPhrase.trim()) {
      toast.error('Escribe una frase para generar tu avatar');
      return;
    }

    setIsUpdating(true);
    try {
      const newAvatarUrl = generateAvatarUrl(avatarPhrase);
      if (!newAvatarUrl) {
        toast.error('Error al generar el avatar');
        return;
      }

      await updateEmployee({
        ...employee,
        avatarUrl: newAvatarUrl
      });

      toast.success('Avatar actualizado correctamente');
      setAvatarPhrase('');
      setPreviewAvatar(null);
    } catch (error: any) {
      console.error('Error actualizando avatar:', error);
      toast.error('Error al actualizar el avatar');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Completa todos los campos de contraseña');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setIsUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('No se pudo obtener la información del usuario');
        return;
      }

      // Llamar a la función edge de Supabase para actualizar la contraseña
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const response = await fetch(`${supabaseUrl}/functions/v1/update-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          userId: user.id,
          password: newPassword
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al cambiar la contraseña');
      }

      toast.success('Contraseña actualizada correctamente');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error cambiando contraseña:', error);
      toast.error(error.message || 'Error al cambiar la contraseña');
    } finally {
      setIsUpdating(false);
    }
  };

  const currentAvatarUrl = previewAvatar || employee.avatarUrl || generateAvatarUrl(employee.name);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" size="sm">
          <Settings className="h-4 w-4" />
          Ajustes
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-slate-600" />
            Ajustes de cuenta
          </DialogTitle>
          <DialogDescription>
            Gestiona tu contraseña y avatar personalizado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Sección Avatar */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <User className="h-4 w-4" />
              Avatar
            </div>
            
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border-2 border-slate-200">
                <AvatarImage src={currentAvatarUrl || undefined} alt={employee.name} />
                <AvatarFallback className="bg-indigo-600 text-white font-medium text-lg">
                  {employee.first_name?.[0] || employee.name[0]}
                  {employee.last_name?.[0] || employee.name[1]}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-2">
                <Label htmlFor="avatar-phrase">Frase para generar avatar</Label>
                <div className="flex gap-2">
                  <Input
                    id="avatar-phrase"
                    placeholder="Ej: Mi nombre es Alex"
                    value={avatarPhrase}
                    onChange={(e) => handleAvatarPhraseChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && avatarPhrase.trim()) {
                        handleUpdateAvatar();
                      }
                    }}
                  />
                  <Button
                    onClick={handleUpdateAvatar}
                    disabled={isUpdating || !avatarPhrase.trim()}
                    size="icon"
                    variant="outline"
                  >
                    <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Escribe cualquier frase y se generará un avatar único basado en ella
                </p>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-200" />

          {/* Sección Contraseña */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Lock className="h-4 w-4" />
              Cambiar contraseña
            </div>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nueva contraseña</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Repite la nueva contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newPassword && confirmPassword) {
                      handleChangePassword();
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
          <Button
            onClick={handleChangePassword}
            disabled={isUpdating || !newPassword || !confirmPassword}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isUpdating ? 'Actualizando...' : 'Cambiar contraseña'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

