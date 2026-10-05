import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { supabase } from '../../services/supabaseClient'; // Ajusta la ruta a tu cliente de Supabase

@Component({
  selector: 'app-estado-cliente',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './estado-cliente.html',
  styleUrls: ['./estado-cliente.css']
})
export class EstadoClienteComponent implements OnInit {
  cliente: any = {
    nombre: '',
    apellido: '',
    dinero: 0,
    puntos: 0,
    creditos: 0
  };
  
  cargando: boolean = true;

  constructor(private cdr: ChangeDetectorRef) {}

  async ngOnInit(): Promise<void> {
    await this.cargarEstadoCliente();
  }

  async cargarEstadoCliente(): Promise<void> {
    try {
      this.cargando = true;

      // 1. Obtener usuario actual autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.warn('⚠️ No hay usuario autenticado actualmente.');
        this.cargando = false;
        return;
      }

      // 2. Consultar la tabla 'clientes' (o 'profiles' según tu base de datos)
      const { data, error } = await supabase
        .from('clientes') // Cambia 'clientes' si tu tabla se llama distinto (ej. 'profiles')
        .select('nombre, apellido, dinero, puntos, creditos')
        .eq('id', user.id) // O eq('user_id', user.id) dependiendo de tu relación
        .single();

      if (error) {
        console.error('❌ Error al obtener datos del cliente:', error.message);
      } else if (data) {
        this.cliente = data;
      }

    } catch (err: any) {
      console.error('❌ Error general al cargar estado del cliente:', err.message);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }
}