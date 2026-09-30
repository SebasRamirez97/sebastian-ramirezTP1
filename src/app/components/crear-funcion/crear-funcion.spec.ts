import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrearFuncionComponent } from './crear-funcion';

describe('CrearFuncion', () => {
  let component: CrearFuncionComponent;
  let fixture: ComponentFixture<CrearFuncionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearFuncionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CrearFuncionComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
