import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient';
import { ClienteMetadata, EmpleadoMetadata, AdminMetadata, AnonimoMetadata } from '../models/user-metadata';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  // 🔹 Registro de clientes (Supabase Auth con metadatos tipados)
  async signUp(cliente: {
    email: string;
    password: string;
  } & Omit<ClienteMetadata, 'rol'>) {
    const { data, error } = await supabase.auth.signUp({
      email: cliente.email,
      password: cliente.password,
      options: {
        data: {
          ...cliente,
          rol: 'cliente' // 👈 se fuerza el rol
        }
      }
    });
    if (error) throw error;
    return data;
  }

  // 🔹 Login de clientes (Supabase Auth)
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  }

  // 🔹 Registro de empleados (tabla propia)
  async registrarEmpleado(empleado: {
    email: string;
    password: string;
  } & Omit<EmpleadoMetadata, 'rol'>) {
    const { data, error } = await supabase
      .from('usuarios_personal')
      .insert([{
        ...empleado,
        rol: 'empleado',
        estado: 'activo'
      }]);

    if (error) throw error;
    return data;
  }

  // 🔹 Registro de administradores (tabla propia)
  async registrarAdmin(admin: {
    email: string;
    password: string;
  } & Omit<AdminMetadata, 'rol'>) {
    const { data, error } = await supabase
      .from('usuarios_personal')
      .insert([{
        ...admin,
        rol: 'admin',
        estado: 'activo'
      }]);

    if (error) throw error;
    return data;
  }

  // 🔹 Login de empleados y administradores (tabla propia)
  async loginPersonal(email: string, password: string) {
    const { data, error } = await supabase
      .from('usuarios_personal')
      .select('*')
      .eq('email', email)
      .eq('password', password) // ⚠️ en producción usar hash
      .single();

    if (error) throw error;
    return data as EmpleadoMetadata | AdminMetadata;
  }

  // 🔹 Obtener usuario actual (clientes registrados)
  async getUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.warn('No hay sesión activa en Supabase:', error.message);
      return null; // 👈 devolvemos null en vez de romper
    }
    return data.user;
  } catch (err) {
    console.error('Error inesperado al obtener usuario:', err);
    return null;
  }
}

  // 🔹 Cerrar sesión (clientes registrados)
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    localStorage.removeItem('clienteAnonimo');
    return true;
  }

  // 🔹 Login como cliente anónimo
  loginAnonimo(nombre: string = 'Invitado') {
    const clienteAnonimo: AnonimoMetadata = { nombre, rol: 'anonimo' };
    localStorage.setItem('clienteAnonimo', JSON.stringify(clienteAnonimo));
    return clienteAnonimo;
  }

  // 🔹 Obtener cliente anónimo
  getAnonimo(): AnonimoMetadata | null {
    const anonimo = localStorage.getItem('clienteAnonimo');
    return anonimo ? JSON.parse(anonimo) : null;
  }

  // 🔹 Salir como cliente anónimo
  signOutAnonimo() {
    localStorage.removeItem('clienteAnonimo');
  }
}
