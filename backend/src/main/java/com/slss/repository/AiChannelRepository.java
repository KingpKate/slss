package com.slss.repository;

import com.slss.domain.AiChannel;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AiChannelRepository extends JpaRepository<AiChannel, Long> {
  List<AiChannel> findAllByOrderByPriorityAscIdAsc();
  List<AiChannel> findByEnabledTrueOrderByPriorityAscIdAsc();
}
