import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient';
import { ClienteMetadata, EmpleadoMetadata, AdminMetadata, AnonimoMetadata } from '../models/user-metadata';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  // 🔹 Estado reactivo para el rol del usuario actual
  private rolSubject = new BehaviorSubject<string>(localStorage.getItem('rol') || '');
  public rol$: Observable<string> = this.rolSubject.asObservable();

  constructor() {
    const anonimo = this.getAnonimo();
    if (anonimo && !localStorage.getItem('rol')) {
      this.setRol('anonimo');
    }

    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        this.setRol('');
        localStorage.removeItem('clienteAnonimo');
      }
    });
  }

  private setRol(rol: string) {
    if (rol) {
      localStorage.setItem('rol', rol);
    } else {
      localStorage.removeItem('rol');
    }
    this.rolSubject.next(rol);
  }

  async signUpCliente(cliente: { email: string; password: string; } & Omit<ClienteMetadata, 'rol'>) {
    const { data, error } = await supabase.auth.signUp({
      email: cliente.email,
      password: cliente.password,
      options: { data: { rol: 'cliente' } }
    });
    if (error) throw error;

    const user = data.user;
    if (user) {
      await supabase.from('clientes').insert([{
        id: user.id,
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        fecha_nacimiento: cliente.fechaNacimiento,
        tipo_sangre: cliente.tipoSangre,
        color_ojos: cliente.colorOjos,
        vacaciones: cliente.vacaciones
      }]);
    }

    return data;
  }

  async signUpEmpleado(empleado: { email: string; password: string; } & Omit<EmpleadoMetadata, 'rol'>) {
    const { data, error } = await supabase.auth.signUp({
      email: empleado.email,
      password: empleado.password,
      options: { data: { rol: 'empleado' } }
    });
    if (error) throw error;

    const user = data.user;
    if (user) {
      await supabase.from('empleados').insert([{
        id: user.id,
        nombre: empleado.nombre,
        apellido: empleado.apellido,
        estado: 'activo'
      }]);
    }

    return data;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const usuarioCompleto = await this.getUser();
    
    // Casteo para evitar que TypeScript marque error en user_metadata o perfil
    const userAny = usuarioCompleto as any;
    const rolDetectado = userAny?.perfil?.rol || userAny?.user_metadata?.rol || 'cliente';
    this.setRol(rolDetectado);

    return usuarioCompleto;
  }

  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;

    const userId = data.user.id;

    // Administrador
    const { data: admin } = await supabase
      .from('administradores')
      .select('nombre, apellido')
      .eq('id', userId)
      .maybeSingle();

    if (admin) {
      this.setRol('admin');
      return {
        ...data.user,
        perfil: { ...admin, rol: 'admin' }
      };
    }

    // Empleado
    const { data: empleado } = await supabase
      .from('empleados')
      .select('nombre, apellido')
      .eq('id', userId)
      .maybeSingle();

    if (empleado) {
      this.setRol('empleado');
      return {
        ...data.user,
        perfil: { ...empleado, rol: 'empleado' }
      };
    }

    // Cliente
    const { data: cliente } = await supabase
      .from('clientes')
      .select('nombre, apellido')
      .eq('id', userId)
      .maybeSingle();

    if (cliente) {
      this.setRol('cliente');
      return {
        ...data.user,
        perfil: { ...cliente, rol: 'cliente' }
      };
    }

    return {
      ...data.user,
      perfil: null
    };
  }

  loginAnonimo(nombre: string): AnonimoMetadata | null {
    if (!nombre || nombre.trim() === '') return null;
    const clienteAnonimo: AnonimoMetadata = { nombre: nombre.trim(), rol: 'anonimo' };
    localStorage.setItem('clienteAnonimo', JSON.stringify(clienteAnonimo));
    this.setRol('anonimo');
    return clienteAnonimo;
  }

  getAnonimo(): AnonimoMetadata | null {
    const anonimo = localStorage.getItem('clienteAnonimo');
    return anonimo ? JSON.parse(anonimo) : null;
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    localStorage.removeItem('clienteAnonimo');
    this.setRol('');
    return true;
  }

  signOutAnonimo() {
    localStorage.removeItem('clienteAnonimo');
    this.setRol('');
  }

  onAuthStateChange(callback: (isLoggedIn: boolean) => void) {
    supabase.auth.onAuthStateChange((event, session) => {
      callback(!!session);
    });
  }
  
  async checkInitialSession(): Promise<boolean> {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  }
}