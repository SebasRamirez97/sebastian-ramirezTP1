import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient';

@Injectable({ providedIn: 'root' })
export class AuthService {
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
          // inicializamos en 0 los contadores
          puntosFidelizacion: 0,
          creditos: 0,
          comprasHechas: 0,
          peliculasVistas: 0
        }
      }
    });

    if (error) throw error;
    return data;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async loginPersonal(email: string, password: string) {
    const { data, error } = await supabase
      .from('usuarios_personal') // tu tabla en la base
      .select('*')
      .eq('email', email)
      .eq('password', password) // ojo: en un sistema real deberías usar hash
      .single();

    if (error) throw error;
    return data; // devuelve el registro con el campo rol
  }

  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
}
  