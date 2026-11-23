import { Injectable, signal } from '@angular/core';
import { supabase } from './supabaseClient';

@Injectable({
  providedIn: 'root',
})
export class RolStaffService {
  // 'admin' | 'empleado' | 'cliente' | null
  tipoUsuario = signal<'admin' | 'empleado' | 'cliente' | null>(null);
  cargandoRol = signal<boolean>(false);

  async verificarRolActual(): Promise<'admin' | 'empleado' | 'cliente' | null> {
    this.cargandoRol.set(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        this.tipoUsuario.set(null);
        return null;
      }

      // 1. Revisar si está en la tabla administrador
      // Ajusta la columna ('id' o 'user_id' o 'email') según cómo tengas armada tu tabla
      const { data: adminData } = await supabase
        .from('administradores')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (adminData) {
        this.tipoUsuario.set('admin');
        return 'admin';
      }

      // 2. Revisar si está en la tabla empleado
      const { data: empleadoData } = await supabase
        .from('empleados')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (empleadoData) {
        this.tipoUsuario.set('empleado');
        return 'empleado';
      }

      // Si no está en ninguna de las dos, es cliente
      this.tipoUsuario.set('cliente');
      return 'cliente';
    } catch (error) {
      console.error('Error al verificar rol de staff:', error);
      this.tipoUsuario.set('cliente');
      return 'cliente';
    } finally {
      this.cargandoRol.set(false);
    }
  }

  limpiarRol() {
    this.tipoUsuario.set(null);
  }
}