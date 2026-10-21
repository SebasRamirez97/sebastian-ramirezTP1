import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { supabase } from '../../services/supabaseClient';

@Component({
  selector: 'app-estado-cliente',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './estado-cliente.html',
  styleUrls: ['./estado-cliente.css']
})
export class EstadoClienteComponent implements OnInit {
  // 🔹 Definición de estados con Signals (adiós a ChangeDetectorRef)
  cliente = signal<any>({
    nombre: '',
    apellido: '',
    dinero: 0,
    puntos: 0,
    creditos: 0
  });
  
  cargando = signal<boolean>(true);

  async ngOnInit(): Promise<void> {
    await this.cargarEstadoCliente();
  }

  async cargarEstadoCliente(): Promise<void> {
    try {
      this.cargando.set(true);

      // 1. Obtener usuario actual autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.warn('⚠️ No hay usuario autenticado actualmente.');
        this.cargando.set(false);
        return;
      }

      // 2. Consultar la tabla 'clientes'
      const { data, error } = await supabase
        .from('clientes')
        .select('nombre, apellido, dinero, puntos, creditos')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('❌ Error al obtener datos del cliente:', error.message);
      } else if (data) {
        this.cliente.set(data);
      }

    } catch (err: any) {
      console.error('❌ Error general al cargar estado del cliente:', err.message);
    } finally {
      this.cargando.set(false);
    }
  }
}