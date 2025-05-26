import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return status ok with a timestamp', () => {
    const result = controller.check();
    
    // Check structure and types of the response
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('timestamp');
    expect(result.status).toBe('ok');
    
    // Verify timestamp is a valid ISO date string
    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(typeof result.timestamp).toBe('string');
    
    // Verify the timestamp is recent (within the last second)
    const resultDate = new Date(result.timestamp);
    const now = new Date();
    const timeDifference = Math.abs(now.getTime() - resultDate.getTime());
    expect(timeDifference).toBeLessThan(1000);
  });
});
