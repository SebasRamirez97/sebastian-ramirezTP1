import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  inject,
  effect,
  input,
  OnInit,
} from '@angular/core';
import { RolStaffService } from '../services/rol-staff.service';

type RolStaff = 'admin' | 'empleado';

@Directive({
  selector: '[appMostrarSoloStaff]',
  standalone: true,
})
export class MostrarSoloStaffDirective implements OnInit {
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private rolStaffService = inject(RolStaffService);

  rolesPermitidos = input<RolStaff[]>(['admin', 'empleado'], {
    alias: 'appMostrarSoloStaff',
  });

  constructor() {
    effect(() => {
      const rolRaw = this.rolStaffService.tipoUsuario();
      const rolNormalizado = typeof rolRaw === 'string' ? rolRaw.toLowerCase().trim() : null;

      const inputRoles = this.rolesPermitidos();
      const rolesObjetivo: string[] =
        Array.isArray(inputRoles) && inputRoles.length > 0
          ? inputRoles.map((r) => r.toLowerCase().trim())
          : ['admin', 'empleado'];

      const debeMostrar = rolNormalizado !== null && rolesObjetivo.includes(rolNormalizado);

      if (debeMostrar) {
        if (this.viewContainer.length === 0) {
          this.viewContainer.createEmbeddedView(this.templateRef);
        }
      } else {
        if (this.viewContainer.length > 0) {
          this.viewContainer.clear();
        }
      }
    });
  }

  async ngOnInit() {
    if (this.rolStaffService.tipoUsuario() === null) {
      await this.rolStaffService.verificarRolActual();
    }
  }
}