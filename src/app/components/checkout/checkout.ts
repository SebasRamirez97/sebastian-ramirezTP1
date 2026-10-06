import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EntradasService } from '../../services/entradas.services';
import { supabase } from '../../services/supabaseClient';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checkout.html',
  styleUrls: ['./checkout.css']
})
export class CheckoutComponent implements OnInit {
  funcionId: string = '';
  usuarioId: string | null = null; // Permitimos null para anónimos
  misAsientos: any[] = [];
  cargando: boolean = true;
  montoIngresadoAnonimo: number = 0;
  
  funcionData: any = {
    precio_pesos: 0,
    precio_puntos: 0
  };
  
  metodoPago: string = 'efectivo';
  creditosAUsar: number = 0;

  // IDs locales si es anónimo
  private idsAsientosAnonimo: string[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private entradasService: EntradasService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    this.funcionId = this.route.snapshot.paramMap.get('funcionId') || '';

    const { data: authData } = await supabase.auth.getUser();
    
    if (authData?.user) {
      this.usuarioId = authData.user.id;
    } else {
      this.usuarioId = null;
      const anonimoStr = localStorage.getItem('clienteAnonimo');
      if (anonimoStr) {
        const anonimo = JSON.parse(anonimoStr);
        this.idsAsientosAnonimo = anonimo.asientosSeleccionados || [];
      }
    }

    await this.cargarDatosCheckout();
  }

  async cargarDatosCheckout(): Promise<void> {
    try {
      this.cargando = true;
      await this.cargarDetalleFuncion();
      await this.cargarAsientosSeleccionados();
    } catch (error: any) {
      alert('Hubo un error al cargar el resumen de compra: ' + error.message);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges(); 
    }
  }

  async cargarDetalleFuncion(): Promise<void> {
    const { data, error } = await supabase
      .from('funciones')
      .select('precio_pesos, precio_puntos')
      .eq('id', this.funcionId)
      .single();

    if (!error && data) {
      this.funcionData = data;
    }
  }

  async cargarAsientosSeleccionados(): Promise<void> {
    const todasLasEntradas = await this.entradasService.getEntradasPorFuncion(this.funcionId);
    
    if (!todasLasEntradas) {
      this.misAsientos = [];
      return;
    }

    if (this.usuarioId) {
      // Usuario registrado: filtra por su UUID
      this.misAsientos = todasLasEntradas.filter(
        e => e.usuario_id === this.usuarioId && e.estado === 'seleccionado'
      );
    } else {
      // Usuario anónimo: filtra por los IDs guardados en el localStorage
      this.misAsientos = todasLasEntradas.filter(
        e => this.idsAsientosAnonimo.includes(e.id) && e.estado === 'seleccionado'
      );
    }

    if (this.misAsientos.length === 0) {
      alert('No tienes asientos seleccionados o tu sesión de selección expiró.');
      this.router.navigate(['/cartelera']);
    }
  }

  get totalPagar(): number {
    const precio = this.funcionData.precio_pesos || 0;
    return this.misAsientos.length * precio;
  }

  get totalPuntos(): number {
    const precioPts = this.funcionData.precio_puntos || 0;
    return this.misAsientos.length * precioPts;
  }

  async confirmarPagoFinal(): Promise<void> {
    try {
      if (!this.usuarioId) {
        if (Number(this.montoIngresadoAnonimo) !== Number(this.totalPagar)) {
          alert(`El monto ingresado ($${this.montoIngresadoAnonimo}) debe ser exacto al total a pagar ($${this.totalPagar}).`);
          return;
        }

        const codigoUnico = await this.entradasService.confirmarCompra(
          null, 
          this.misAsientos, 
          'efectivo'
        );

        // Limpiamos los asientos del localStorage del anónimo
        const anonimoStr = localStorage.getItem('clienteAnonimo');
        if (anonimoStr) {
          const anonimo = JSON.parse(anonimoStr);
          anonimo.asientosSeleccionados = [];
          localStorage.setItem('clienteAnonimo', JSON.stringify(anonimo));
        }

        alert(`¡Pago exitoso! Tu código de retiro único es: ${codigoUnico}`);
        this.router.navigate(['/cartelera']);
        return;
      }


      if (!this.usuarioId) {
        const codigoUnico = await this.entradasService.confirmarCompra(
          null, 
          this.misAsientos, 
          'efectivo' // o el método que elija
        );

        // Limpiamos los asientos del localStorage del anónimo tras una compra exitosa
        const anonimoStr = localStorage.getItem('clienteAnonimo');
        if (anonimoStr) {
          const anonimo = JSON.parse(anonimoStr);
          anonimo.asientosSeleccionados = [];
          localStorage.setItem('clienteAnonimo', JSON.stringify(anonimo));
        }

        alert(`¡Pago exitoso! Tu código de retiro único es: ${codigoUnico}`);
        this.router.navigate(['/cartelera']);
        return;
      }

      // --- Flujo normal para usuarios registrados ---
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('dinero, puntos, creditos')
        .eq('id', this.usuarioId)
        .single();

      if (clienteError || !clienteData) {
        throw new Error('No se pudo verificar el saldo de tu cuenta.');
      }

      const dineroActual = Number(clienteData.dinero || 0);
      const puntosActuales = Number(clienteData.puntos || 0);
      const creditosActuales = Number(clienteData.creditos || 0);

      let dineroADescontar = 0;
      let creditosADescontar = 0;

      if (this.metodoPago === 'efectivo') {
        if (dineroActual < this.totalPagar) {
          alert(`Saldo insuficiente. Tienes $${dineroActual} y necesitas $${this.totalPagar}.`);
          return;
        }
        dineroADescontar = this.totalPagar;

      } else if (this.metodoPago === 'puntos') {
        if (puntosActuales < this.totalPuntos) {
          alert(`Puntos insuficientes. Tienes ${puntosActuales} Pts y necesitas ${this.totalPuntos} Pts.`);
          return;
        }
        const nuevosPuntos = puntosActuales - this.totalPuntos;
        const { error: updateError } = await supabase
          .from('clientes')
          .update({ puntos: nuevosPuntos })
          .eq('id', this.usuarioId);

        if (updateError) throw updateError;

      } else if (this.metodoPago === 'mixto') {
        creditosADescontar = Number(this.creditosAUsar || 0);
        
        if (creditosADescontar < 0) {
          alert('Los créditos a usar no pueden ser negativos.');
          return;
        }

        if (creditosADescontar > creditosActuales) {
          alert(`No tienes tantos créditos. Dispones de ${creditosActuales} créditos.`);
          return;
        }

        if (creditosADescontar > this.totalPagar) {
          alert('Estás intentando usar más créditos de lo que cuesta la entrada.');
          return;
        }

        dineroADescontar = this.totalPagar - creditosADescontar;

        if (dineroActual < dineroADescontar) {
          alert(`Saldo de dinero insuficiente. Necesitas $${dineroADescontar} en dinero y solo tienes $${dineroActual}.`);
          return;
        }

        const nuevoDinero = dineroActual - dineroADescontar;
        const nuevosCreditos = creditosActuales - creditosADescontar;

        const { error: updateError } = await supabase
          .from('clientes')
          .update({ 
            dinero: nuevoDinero, 
            creditos: nuevosCreditos 
          })
          .eq('id', this.usuarioId);

        if (updateError) throw updateError;
      }

      if (this.metodoPago === 'efectivo') {
        const nuevoDinero = dineroActual - dineroADescontar;
        const { error: updateError } = await supabase
          .from('clientes')
          .update({ dinero: nuevoDinero })
          .eq('id', this.usuarioId);

        if (updateError) throw updateError;
      }

      const codigoUnico = await this.entradasService.confirmarCompra(
        this.usuarioId, 
        this.misAsientos, 
        this.metodoPago
      );

      alert(`¡Pago exitoso! Tu código de retiro único es: ${codigoUnico}`);
      this.router.navigate(['/cartelera']);

    } catch (error: any) {
      alert(`Error al procesar el pago: ${error.message}`);
    }
  }

  volverSeleccion(): void {
    this.router.navigate(['/seleccionar-asientos', this.funcionId]);
  }

  
}