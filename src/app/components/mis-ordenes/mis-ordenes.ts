import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { supabase } from '../../services/supabaseClient';

@Component({
  selector: 'app-mis-ordenes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mis-ordenes.html',
  styleUrls: ['./mis-ordenes.css']
})
export class MisOrdenesComponent implements OnInit {
  misOrdenes: any[] = [];
  cargando: boolean = true;
  ordenSeleccionada: any = null; // Para el modal de detalles y QR

  constructor(private router: Router, private cdr: ChangeDetectorRef) {}

  async ngOnInit(): Promise<void> {
    await this.cargarMisOrdenes();
  }

  async cargarMisOrdenes(): Promise<void> {
  try {
    this.cargando = true;
    const { data: authData } = await supabase.auth.getUser();
    const usuarioId = authData?.user?.id;

    if (!usuarioId) {
      this.cargando = false;
      return;
    }

    const { data, error } = await supabase
      .from('ordenes')
      .select(`
        id,
        codigo_retiro,
        metodo_pago,
        total,
        created_at,
        entradas (
          id,
          fila,
          numero_asiento,
          estado,
          funciones (
            fecha_inicio,
            formato,
            salas (nombre),
            peliculas (nombre, imagen)
          )
        )
      `)
      .eq('usuario_id', usuarioId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    this.misOrdenes = data || [];

  } catch (error: any) {
    console.error('Error al cargar órdenes:', error.message);
  } finally {
    this.cargando = false;
    this.cdr.detectChanges();
  }
}

  verDetallesOrden(orden: any): void {
    this.ordenSeleccionada = orden;
  }

  cerrarDetalles(): void {
    this.ordenSeleccionada = null;
  }

  volver(): void {
    this.router.navigate(['/home']);
  }
}