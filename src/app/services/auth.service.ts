import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  // 🔹 Registro de clientes (Supabase Auth con metadatos)
  async signUp(cliente: {
    email: string;
    password: string;
    nombre: string;
    apellido: string;
    fechaNacimiento: string;
    tipoSangre: string;
    colorOjos: string;
    vacaciones: number;
  }) {
    const { data, error } = await supabase.auth.signUp({
      email: cliente.email,
      password: cliente.password,
      options: {
        data: {
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          fechaNacimiento: cliente.fechaNacimiento,
          tipoSangre: cliente.tipoSangre,
          colorOjos: cliente.colorOjos,
          vacaciones: cliente.vacaciones,
          rol: 'cliente'
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

  // 🔹 Login de empleados y administradores (tabla propia)
  async loginPersonal(email: string, password: string) {
    const { data, error } = await supabase
      .from('usuarios_personal')
      .select('*')
      .eq('email', email)
      .eq('password', password) // ⚠️ en producción usar hash
      .single();

    if (error) throw error;
    return data; // incluye el campo rol
  }

  // 🔹 Obtener usuario actual (clientes registrados)
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  }

  // 🔹 Cerrar sesión (clientes registrados)
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // limpiar también cliente anónimo si existía
    localStorage.removeItem('clienteAnonimo');
  }

  // 🔹 Login como cliente anónimo
  loginAnonimo(nombre: string = 'Invitado') {
    const clienteAnonimo = { nombre, rol: 'anonimo' };
    localStorage.setItem('clienteAnonimo', JSON.stringify(clienteAnonimo));
    return clienteAnonimo;
  }

  // 🔹 Obtener cliente anónimo
  getAnonimo() {
    const anonimo = localStorage.getItem('clienteAnonimo');
    return anonimo ? JSON.parse(anonimo) : null;
  }

  // 🔹 Salir como cliente anónimo
  signOutAnonimo() {
    localStorage.removeItem('clienteAnonimo');
  }
}

  
