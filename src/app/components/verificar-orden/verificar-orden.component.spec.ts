import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VerificarOrdenComponent } from './verificar-orden.component';

describe('VerificarEntrada', () => {
  let component: VerificarOrdenComponent;
  let fixture: ComponentFixture<VerificarOrdenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerificarOrdenComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VerificarOrdenComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
