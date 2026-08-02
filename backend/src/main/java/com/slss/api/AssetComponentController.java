package com.slss.api;

import com.slss.repository.AssetComponentRepository;
import com.slss.repository.AssetRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/assets/{machineSn}/components")
@PreAuthorize("hasAnyAuthority('PERM_VIEW_PRODUCTION','PERM_MANAGE_PRODUCTION','PERM_VIEW_ORDERS','PERM_MANAGE_ORDERS')")
public class AssetComponentController {
  private final AssetRepository assets;
  private final AssetComponentRepository components;

  public AssetComponentController(AssetRepository assets, AssetComponentRepository components) {
    this.assets = assets;
    this.components = components;
  }

  @GetMapping
  public Object list(@PathVariable String machineSn) {
    var asset = assets.findByMachineSnIgnoreCase(machineSn).orElseThrow();
    return components.findByAssetIdOrderById(asset.getId()).stream()
        .map(c -> new ComponentResponse(c.getId(), c.getComponentType(), c.getModel(), c.getSerialNo()))
        .toList();
  }

  public record ComponentResponse(Long id, String componentType, String model, String serialNo) {}
}
