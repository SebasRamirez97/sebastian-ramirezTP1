import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient';
import { ClienteMetadata, EmpleadoMetadata, AdminMetadata, AnonimoMetadata } from '../models/user-metadata';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  // 🔹 Registro de clientes
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

  // 🔹 Registro de empleados (hecho por un admin)
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

  // 🔹 Registro de administradores (manual o inicial)
  async signUpAdmin(admin: { email: string; password: string; } & Omit<AdminMetadata, 'rol'>) {
    const { data, error } = await supabase.auth.signUp({
      email: admin.email,
      password: admin.password,
      options: { data: { rol: 'admin' } }
    });
    if (error) throw error;

    const user = data.user;
    if (user) {
      await supabase.from('administradores').insert([{
        id: user.id,
        nombre: admin.nombre,
        apellido: admin.apellido
      }]);
    }

    return data;
  }

  // 🔹 Login (para cualquier rol)
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  // 🔹 Obtener usuario actual
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user; // aquí podés leer user_metadata.rol
  }

  // 🔹 Cerrar sesión
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    localStorage.removeItem('clienteAnonimo');
    return true;
  }

  // 🔹 Login anónimo
  loginAnonimo(nombre: string): AnonimoMetadata | null {
    if (!nombre || nombre.trim() === '') return null;
    const clienteAnonimo: AnonimoMetadata = { nombre: nombre.trim(), rol: 'anonimo' };
    localStorage.setItem('clienteAnonimo', JSON.stringify(clienteAnonimo));
    return clienteAnonimo;
  }

  getAnonimo(): AnonimoMetadata | null {
    const anonimo = localStorage.getItem('clienteAnonimo');
    return anonimo ? JSON.parse(anonimo) : null;
  }

  signOutAnonimo() {
    localStorage.removeItem('clienteAnonimo');
  }
}
