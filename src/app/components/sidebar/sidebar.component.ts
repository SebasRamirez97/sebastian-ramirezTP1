import { Component, Input } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  @Input() rol: string = ''; // rol recibido desde Home o App

  constructor(private authService: AuthService, private router: Router) {}

  cerrarSesion() {
    this.authService.signOut();
    this.router.navigate(['/login']);
  }

  salirAnonimo() {
    this.authService.signOutAnonimo();
    this.router.navigate(['/login']);
  }
}
