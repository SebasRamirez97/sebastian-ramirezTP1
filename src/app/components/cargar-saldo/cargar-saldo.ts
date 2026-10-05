import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { supabase } from '../../services/supabaseClient';

@Component({
  selector: 'app-cargar-saldo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cargar-saldo.html',
  styleUrls: ['./cargar-saldo.css']
})
export class CargarSaldoComponent {
  montoACargar: number = 1000; // Valor por defecto
  cargando: boolean = false;

  constructor(private router: Router, private cdr: ChangeDetectorRef) {}

  async procesarCarga(): Promise<void> {
    if (this.montoACargar <= 0) {
      alert('Por favor, ingresa un monto válido mayor a 0.');
      return;
    }

    try {
      this.cargando = true;

      // 1. Obtener el usuario autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        alert('Debes iniciar sesión para recargar saldo.');
        return;
      }

      // 2. Consultar el saldo actual del cliente para sumarle el nuevo monto
      const { data: clienteData, error: fetchError } = await supabase
        .from('clientes')
        .select('dinero')
        .eq('id', user.id)
        .single();

      if (fetchError) {
        throw new Error('No se pudo obtener la información actual del cliente.');
      }

      const dineroActual = clienteData?.dinero || 0;
      const nuevoDinero = Number(dineroActual) + Number(this.montoACargar);

      // 3. Actualizar la base de datos con el nuevo saldo
      const { error: updateError } = await supabase
        .from('clientes')
        .update({ dinero: nuevoDinero })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      alert(`¡Recarga exitosa! Se han acreditado $${this.montoACargar} a tu cuenta.`);
      
      // Redirigir de vuelta al estado del cliente o cartelera
      this.router.navigate(['/estado-cliente']);

    } catch (error: any) {
      console.error('Error al recargar saldo:', error.message);
      alert('Hubo un error al procesar la recarga: ' + error.message);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  volver(): void {
    this.router.navigate(['/estado-cliente']);
  }
}