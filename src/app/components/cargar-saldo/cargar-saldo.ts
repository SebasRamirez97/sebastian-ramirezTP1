import { Component, signal, inject } from '@angular/core';
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
  // 🔹 Inyección de dependencias moderna con inject()
  private router = inject(Router);

  // 🔹 Definición de estados con Signals
  montoACargar = signal<number>(1000); // Valor por defecto
  cargando = signal<boolean>(false);

  // Métodos auxiliares para actualizar o leer el monto desde el template
  actualizarMonto(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.montoACargar.set(Number(target.value) || 0);
  }

  setMontoRapido(monto: number): void {
    this.montoACargar.set(monto);
  }

  async procesarCarga(): Promise<void> {
    const monto = this.montoACargar();

    if (monto <= 0) {
      alert('Por favor, ingresa un monto válido mayor a 0.');
      return;
    }

    try {
      this.cargando.set(true);

      // 1. Intentar ver si hay un usuario autenticado en Supabase
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (!authError && user) {
        // --- FLUJO PARA USUARIO REGISTRADO (SUPABASE) ---
        const { data: clienteData, error: fetchError } = await supabase
          .from('clientes')
          .select('dinero')
          .eq('id', user.id)
          .single();

        if (fetchError) {
          throw new Error('No se pudo obtener la información actual del cliente.');
        }

        const dineroActual = clienteData?.dinero || 0;
        const nuevoDinero = Number(dineroActual) + Number(monto);

        const { error: updateError } = await supabase
          .from('clientes')
          .update({ dinero: nuevoDinero })
          .eq('id', user.id);

        if (updateError) throw updateError;

      } else {
        // --- FLUJO PARA USUARIO ANÓNIMO (LOCALSTORAGE) ---
        const anonimoStr = localStorage.getItem('clienteAnonimo');
        
        if (!anonimoStr) {
          alert('No se encontró una sesión activa ni de usuario ni de invitado.');
          this.router.navigate(['/']);
          return;
        }

        const clienteAnonimo = JSON.parse(anonimoStr);
        const saldoActual = clienteAnonimo.dinero || 0;
        clienteAnonimo.dinero = Number(saldoActual) + Number(monto);

        localStorage.setItem('clienteAnonimo', JSON.stringify(clienteAnonimo));
      }

      alert(`¡Recarga exitosa! Se han acreditado $${monto} a tu cuenta.`);
      this.router.navigate(['/estado-cliente']);

    } catch (error: any) {
      console.error('Error al recargar saldo:', error.message);
      alert('Hubo un error al procesar la recarga: ' + error.message);
    } finally {
      this.cargando.set(false);
    }
  }

  volver(): void {
    this.router.navigate(['/estado-cliente']);
  }
}