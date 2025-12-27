import { useState } from 'react';
// ELIMINADO: import { AppLayout } from '@/components/layout/AppLayout'; <--- CAUSA DEL ERROR
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { PlusCircle, ShieldCheck } from 'lucide-react';

export default function SettingsPage() {
    const [platform, setPlatform] = useState('meta');
    const [accountId, setAccountId] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAddAccount = async () => {
        if (!accountId) return toast.error("Por favor, escribe un ID de cuenta.");
        
        setLoading(true);
        // Insertamos en la nueva tabla de configuración
        const { error } = await supabase.from('ad_accounts_config').insert({
            platform: platform,
            account_id: accountId,
            is_active: true
        });

        if (error) {
            console.error(error);
            if (error.code === '23505') toast.error("Esta cuenta ya está registrada.");
            else toast.error("Error al guardar la cuenta.");
        } else {
            toast.success(`Cuenta ${platform} añadida. Sincroniza ahora para ver datos.`);
            setAccountId('');
        }
        setLoading(false);
    };

    return (
        // ELIMINADO EL WRAPPER <AppLayout>
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
            
            {/* TARJETA PARA AÑADIR CUENTAS */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <PlusCircle className="w-5 h-5 text-blue-600"/> 
                        Gestión de cuentas publicitarias
                    </CardTitle>
                    <CardDescription>
                        Añade aquí los IDs de las cuentas de tus clientes para que el sistema las sincronice.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="space-y-2 w-full md:w-1/4">
                            <Label>Plataforma</Label>
                            <Select value={platform} onValueChange={setPlatform}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="meta">Meta Ads (Facebook)</SelectItem>
                                    <SelectItem value="google">Google Ads</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 w-full md:w-2/4">
                            <Label>ID de la cuenta</Label>
                            <Input 
                                placeholder={platform === 'meta' ? 'Ej: act_123456789' : 'Ej: 123-456-7890'} 
                                value={accountId} 
                                onChange={(e) => setAccountId(e.target.value)} 
                            />
                        </div>
                        <Button onClick={handleAddAccount} disabled={loading} className="w-full md:w-1/4 bg-slate-900 hover:bg-slate-800">
                            {loading ? 'Guardando...' : 'Añadir cuenta'}
                        </Button>
                    </div>
                    <div className="bg-slate-50 p-3 rounded text-xs text-slate-500 border border-slate-100">
                        <strong>Nota importante:</strong> 
                        <ul className="list-disc pl-4 mt-1 space-y-1">
                            <li>Para <strong>Meta</strong>: El ID debe incluir el prefijo (ej: <code>act_147...</code>).</li>
                            <li>Para <strong>Google</strong>: Usa el formato con guiones (ej: <code>123-456-7890</code>).</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600"/> Estado del sistema</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-slate-600">
                        <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>
                        Sistema operativo y conectado a base de datos.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
